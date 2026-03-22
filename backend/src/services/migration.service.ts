import { PrismaClient, Migration, MigrationLog, Alert, StatsHistory } from '@prisma/client';
import { MediastreamService } from './mediastream.service.js';
import { CSVValidatorService } from './csv-validator.service.js';
import { TemplateService } from './template.service.js';
import { NotificationService } from './notification.service.js';
import {
  MappingConfig,
  RetryPolicy,
  EnrichedStats,
  MediastreamStats,
  CSVValidationResult,
} from '../types/index.js';
import { config } from '../config/index.js';
import { getIO } from '../socket.js';

export class MigrationService {
  private prisma: PrismaClient;
  private csvValidator: CSVValidatorService;
  private templateService: TemplateService;
  private notificationService: NotificationService;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private statsHistory: Map<string, { timestamp: number; done: number }[]> = new Map();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.csvValidator = new CSVValidatorService();
    this.templateService = new TemplateService(prisma);
    this.notificationService = new NotificationService(prisma);
  }

  private async ms(): Promise<MediastreamService> {
    return MediastreamService.fromActiveSession();
  }

  // ==================== Migration CRUD ====================

  async create(data: {
    name: string;
    strategy: 'transcode' | 'upload';
    mappings: MappingConfig[];
    templateId?: string;
    retryPolicy?: RetryPolicy;
  }): Promise<Migration> {
    const migration = await this.prisma.migration.create({
      data: {
        name: data.name,
        strategy: data.strategy,
        mappings: JSON.stringify(data.mappings),
        templateId: data.templateId,
        retryEnabled: data.retryPolicy?.enabled ?? true,
        maxRetries: data.retryPolicy?.maxRetries ?? config.retry.defaultMaxRetries,
        retryBackoffType: data.retryPolicy?.backoffType ?? 'exponential',
        retryInitialDelay: data.retryPolicy?.initialDelay ?? config.retry.defaultInitialDelay,
        retryMaxDelay: data.retryPolicy?.maxDelay ?? config.retry.defaultMaxDelay,
      },
    });

    if (data.templateId) {
      await this.templateService.incrementUsage(data.templateId);
    }

    await this.log(migration.id, 'info', 'system', 'Migración creada');

    return migration;
  }

  async getById(id: string): Promise<Migration | null> {
    return this.prisma.migration.findUnique({
      where: { id },
      include: {
        template: true,
        validationResults: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async list(): Promise<Migration[]> {
    return this.prisma.migration.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        template: true,
      },
    });
  }

  async update(id: string, data: Partial<{
    name: string;
    mappings: MappingConfig[];
    retryPolicy: RetryPolicy;
  }>): Promise<Migration> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.mappings !== undefined) updateData.mappings = JSON.stringify(data.mappings);
    if (data.retryPolicy !== undefined) {
      updateData.retryEnabled = data.retryPolicy.enabled;
      updateData.maxRetries = data.retryPolicy.maxRetries;
      updateData.retryBackoffType = data.retryPolicy.backoffType;
      updateData.retryInitialDelay = data.retryPolicy.initialDelay;
      updateData.retryMaxDelay = data.retryPolicy.maxDelay;
    }

    return this.prisma.migration.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    // Detener monitoreo si está activo
    this.stopMonitoring(id);

    // Eliminar de Mediastream si existe
    const migration = await this.getById(id);
    if (migration?.mediastreamConfigId) {
      try {
        await (await this.ms()).deleteMigration(migration.mediastreamConfigId);
      } catch {
        // Ignorar si falla en Mediastream
      }
    }

    await this.prisma.migration.delete({ where: { id } });
  }

  // ==================== CSV Validation ====================

  async validateCSV(
    migrationId: string,
    filePath: string,
    options?: { checkUrls?: boolean }
  ): Promise<CSVValidationResult> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');

    await this.updateStatus(migrationId, 'validating');
    await this.log(migrationId, 'info', 'validation', 'Iniciando validación de CSV');

    const mappings = JSON.parse(migration.mappings) as MappingConfig[];
    const result = await this.csvValidator.validateCSV(filePath, mappings, options);

    // Guardar resultado de validación
    await this.prisma.validationResult.create({
      data: {
        migrationId,
        isValid: result.isValid,
        totalRows: result.totalRows,
        validRows: result.validRows,
        errorRows: result.errorRows,
        warningRows: result.warningRows,
        errors: JSON.stringify(result.errors),
        warnings: JSON.stringify(result.warnings),
        urlsChecked: result.urlDetails.length,
        urlsAccessible: result.urlDetails.filter((u) => u.accessible).length,
        urlsWithRateLimit: result.urlDetails.filter((u) => u.hasRateLimit).length,
        urlDetails: JSON.stringify(result.urlDetails),
        duplicates: JSON.stringify(result.duplicates),
        emptyFields: JSON.stringify(result.emptyFields),
      },
    });

    // Actualizar migración
    await this.prisma.migration.update({
      where: { id: migrationId },
      data: {
        status: result.isValid ? 'validated' : 'error',
        totalItems: result.totalRows,
        csvFileName: filePath.split('/').pop() || filePath.split('\\').pop(),
      },
    });

    await this.log(
      migrationId,
      result.isValid ? 'info' : 'error',
      'validation',
      `Validación completada: ${result.validRows}/${result.totalRows} válidos`,
      { errors: result.errors.length, warnings: result.warnings.length }
    );

    return result;
  }

  // ==================== Mediastream Integration ====================

  async createInMediastream(migrationId: string): Promise<string> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');

    const mappings = JSON.parse(migration.mappings) as MappingConfig[];

    const msConfig = await (await this.ms()).createMigration({
      name: migration.name,
      strategy: migration.strategy as 'transcode' | 'upload',
      mappings,
    });

    await this.prisma.migration.update({
      where: { id: migrationId },
      data: { mediastreamConfigId: msConfig._id },
    });

    await this.log(migrationId, 'info', 'system', 'Migración creada en Mediastream', {
      mediastreamId: msConfig._id,
    });

    return msConfig._id!;
  }

  async start(migrationId: string): Promise<void> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');
    if (!migration.mediastreamConfigId) {
      throw new Error('Migración no creada en Mediastream');
    }

    await (await this.ms()).startMigration(migration.mediastreamConfigId);

    await this.prisma.migration.update({
      where: { id: migrationId },
      data: {
        status: 'running',
        startedAt: migration.startedAt || new Date(),
      },
    });

    await this.log(migrationId, 'info', 'system', 'Migración iniciada');

    // Iniciar monitoreo
    this.startMonitoring(migrationId);
  }

  async stop(migrationId: string): Promise<void> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');
    if (!migration.mediastreamConfigId) {
      throw new Error('Migración no creada en Mediastream');
    }

    await (await this.ms()).stopMigration(migration.mediastreamConfigId);

    await this.updateStatus(migrationId, 'paused');

    await this.log(migrationId, 'info', 'system', 'Migración pausada');

    // Detener monitoreo
    this.stopMonitoring(migrationId);
  }

  async retry(migrationId: string): Promise<void> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');
    if (!migration.mediastreamConfigId) {
      throw new Error('Migración no creada en Mediastream');
    }

    await (await this.ms()).retryMigration(migration.mediastreamConfigId);

    await this.prisma.migration.update({
      where: { id: migrationId },
      data: {
        currentRetryCount: { increment: 1 },
        status: 'running',
      },
    });

    await this.log(
      migrationId,
      'info',
      'retry',
      `Reintento #${migration.currentRetryCount + 1} ejecutado`
    );

    // Reiniciar monitoreo
    this.startMonitoring(migrationId);
  }

  async resume(migrationId: string): Promise<{ fromRow: number }> {
    const migration = await this.getById(migrationId);
    if (!migration) throw new Error('Migración no encontrada');
    if (!migration.mediastreamConfigId) throw new Error('Migración no creada en Mediastream');
    if (!migration.checkpointData) throw new Error('No hay checkpoint guardado para esta migración');

    if (!['paused', 'error'].includes(migration.status)) {
      throw new Error(`No se puede reanudar desde estado "${migration.status}"`);
    }

    const checkpoint = JSON.parse(migration.checkpointData) as {
      lastSuccessfulRow: number;
      sm2MigrationId: string;
      timestamp: string;
    };

    // SM2 no soporta reanudación parcial nativa — reiniciamos la migración en SM2
    // pero mantenemos el contexto de checkpoint en nuestra DB para auditoría.
    await (await this.ms()).startMigration(migration.mediastreamConfigId);

    await this.prisma.migration.update({
      where: { id: migrationId },
      data: {
        status: 'running',
        startedAt: migration.startedAt || new Date(),
      },
    });

    await this.log(
      migrationId,
      'info',
      'system',
      `Migración reanudada desde checkpoint (fila ${checkpoint.lastSuccessfulRow})`,
      { checkpoint }
    );

    this.startMonitoring(migrationId);

    return { fromRow: checkpoint.lastSuccessfulRow };
  }

  // ==================== Stats & Monitoring ====================

  async getStats(migrationId: string): Promise<EnrichedStats | null> {
    const migration = await this.getById(migrationId);
    if (!migration || !migration.mediastreamConfigId) return null;

    const stats = await (await this.ms()).getMigrationStats(migration.mediastreamConfigId);

    return this.enrichStats(migrationId, stats);
  }

  private enrichStats(migrationId: string, stats: MediastreamStats): EnrichedStats {
    const history = this.statsHistory.get(migrationId) || [];
    const now = Date.now();

    // Agregar punto actual
    history.push({ timestamp: now, done: stats.done });

    // Mantener últimos 10 minutos
    const tenMinutesAgo = now - 600000;
    const recentHistory = history.filter((h) => h.timestamp > tenMinutesAgo);
    this.statsHistory.set(migrationId, recentHistory);

    // Calcular velocidad
    let speed = 0;
    if (recentHistory.length >= 2) {
      const oldest = recentHistory[0];
      const newest = recentHistory[recentHistory.length - 1];
      const timeDiff = (newest.timestamp - oldest.timestamp) / 60000;
      const itemsDiff = newest.done - oldest.done;
      speed = timeDiff > 0 ? itemsDiff / timeDiff : 0;
    }

    const total = stats.waiting + stats.queued + stats.running + stats.done + stats.error;
    const completed = stats.done + stats.error;
    const remaining = stats.waiting + stats.queued + stats.running;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    const eta = speed > 0 ? (remaining / speed) * 60000 : null;

    return {
      ...stats,
      total,
      completed,
      remaining,
      percentage: Math.round(percentage * 10) / 10,
      speed: Math.round(speed * 10) / 10,
      eta,
      etaFormatted: eta ? this.formatDuration(eta) : 'Calculando...',
      successRate:
        stats.done > 0 ? Math.round((stats.done / (stats.done + stats.error)) * 1000) / 10 : 100,
    };
  }

  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);

    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  // ==================== Auto-Retry & Monitoring ====================

  startMonitoring(migrationId: string): void {
    // Evitar duplicados
    this.stopMonitoring(migrationId);

    const interval = setInterval(async () => {
      await this.checkMigrationStatus(migrationId);
    }, 30000); // Cada 30 segundos

    this.monitoringIntervals.set(migrationId, interval);
  }

  stopMonitoring(migrationId: string): void {
    const interval = this.monitoringIntervals.get(migrationId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(migrationId);
    }
  }

  private async checkMigrationStatus(migrationId: string): Promise<void> {
    try {
      const migration = await this.getById(migrationId);
      if (!migration || !migration.mediastreamConfigId) {
        this.stopMonitoring(migrationId);
        return;
      }

      const stats = await (await this.ms()).getMigrationStats(migration.mediastreamConfigId);
      const enrichedStats = this.enrichStats(migrationId, stats);

      // Guardar histórico de stats
      await this.prisma.statsHistory.create({
        data: {
          migrationId,
          waiting: stats.waiting,
          queued: stats.queued,
          running: stats.running,
          done: stats.done,
          error: stats.error,
          speed: enrichedStats.speed,
        },
      });

      // Guardar checkpoint de progreso
      const checkpoint = {
        lastSuccessfulRow: stats.done,
        sm2MigrationId: migration.mediastreamConfigId,
        timestamp: new Date().toISOString(),
      };

      // Actualizar migración
      await this.prisma.migration.update({
        where: { id: migrationId },
        data: {
          processedItems: stats.done + stats.error,
          successItems: stats.done,
          errorItems: stats.error,
          lastUpdateAt: new Date(),
          checkpointData: JSON.stringify(checkpoint),
        },
      });

      // Emitir stats en tiempo real vía Socket.IO
      getIO()?.to(`migration:${migrationId}`).emit('migration:stats', enrichedStats);

      // Verificar si está estancado
      await this.checkIfStalled(migrationId, enrichedStats);

      // Verificar si terminó
      if (stats.waiting === 0 && stats.queued === 0 && stats.running === 0) {
        await this.handleMigrationComplete(migrationId, stats);
      }

      // Auto-retry si hay errores y está habilitado
      if (stats.error > 0 && migration.retryEnabled) {
        await this.handleAutoRetry(migrationId, migration, stats);
      }
    } catch (error) {
      console.error('Error monitoring migration:', error);
    }
  }

  private async checkIfStalled(migrationId: string, stats: EnrichedStats): Promise<void> {
    if (stats.running === 0) return;

    const history = await this.prisma.statsHistory.findMany({
      where: { migrationId },
      orderBy: { timestamp: 'desc' },
      take: 10,
    });

    if (history.length < 2) return;

    // Verificar si done no ha cambiado en el threshold
    const oldestRelevant = history[history.length - 1];
    const timeDiff = Date.now() - oldestRelevant.timestamp.getTime();

    if (timeDiff >= config.alerts.stalledThreshold) {
      const allSameDone = history.every((h) => h.done === history[0].done);

      if (allSameDone && stats.running > 0) {
        await this.createAlert(migrationId, {
          type: 'stalled',
          severity: 'warning',
          message: `Migración posiblemente estancada: ${stats.running} items en proceso sin progreso por ${Math.round(timeDiff / 60000)} minutos`,
        });
      }
    }
  }

  private async handleMigrationComplete(
    migrationId: string,
    stats: MediastreamStats
  ): Promise<void> {
    this.stopMonitoring(migrationId);

    await this.prisma.migration.update({
      where: { id: migrationId },
      data: {
        status: 'done',
        completedAt: new Date(),
      },
    });

    // Si completó sin errores, guardar todos los IDs en el historial de deduplicación
    if (stats.error === 0) {
      await this.saveCompletedMigrationIds(migrationId);
    }

    await this.log(
      migrationId,
      'info',
      'system',
      `Migración completada: ${stats.done} exitosos, ${stats.error} errores`
    );

    await this.createAlert(migrationId, {
      type: 'completed',
      severity: stats.error > 0 ? 'warning' : 'info',
      message: `Migración completada: ${stats.done} exitosos, ${stats.error} errores`,
    });

    // Emitir evento de completado vía Socket.IO
    getIO()?.to(`migration:${migrationId}`).emit('migration:status', { status: 'done', stats });

    // Enviar notificaciones externas
    await this.notificationService.notifyMigrationComplete(migrationId, {
      done: stats.done,
      error: stats.error,
    });
  }

  private async handleAutoRetry(
    migrationId: string,
    migration: Migration,
    stats: MediastreamStats
  ): Promise<void> {
    // Solo ejecutar auto-retry si la migración está pausada o terminada
    if (!['paused', 'done'].includes(migration.status)) return;

    // Verificar si no hemos excedido el límite de reintentos
    if (migration.currentRetryCount >= migration.maxRetries) {
      await this.createAlert(migrationId, {
        type: 'retry_exhausted',
        severity: 'critical',
        message: `Se alcanzó el límite de ${migration.maxRetries} reintentos. ${stats.error} items siguen con error.`,
      });
      return;
    }

    // Calcular delay según política
    const delay = this.calculateRetryDelay(
      migration.currentRetryCount,
      migration.retryBackoffType,
      migration.retryInitialDelay,
      migration.retryMaxDelay
    );

    await this.log(
      migrationId,
      'info',
      'retry',
      `Auto-retry programado en ${Math.round(delay / 60000)} minutos`
    );

    // Programar retry
    setTimeout(async () => {
      try {
        await this.retry(migrationId);
      } catch (error) {
        console.error('Auto-retry failed:', error);
      }
    }, delay);
  }

  private calculateRetryDelay(
    attempt: number,
    backoffType: string,
    initialDelay: number,
    maxDelay: number
  ): number {
    let delay: number;

    switch (backoffType) {
      case 'exponential':
        delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        break;
      case 'linear':
        delay = Math.min(initialDelay * (attempt + 1), maxDelay);
        break;
      default:
        delay = initialDelay;
    }

    return delay;
  }

  // ==================== Logging & Alerts ====================

  private async log(
    migrationId: string,
    level: string,
    category: string,
    message: string,
    data?: Record<string, unknown>
  ): Promise<MigrationLog> {
    return this.prisma.migrationLog.create({
      data: {
        migrationId,
        level,
        category,
        message,
        data: data ? JSON.stringify(data) : null,
      },
    });
  }

  async getLogs(
    migrationId: string,
    options?: { level?: string[]; category?: string; limit?: number }
  ): Promise<MigrationLog[]> {
    return this.prisma.migrationLog.findMany({
      where: {
        migrationId,
        ...(options?.level && { level: { in: options.level } }),
        ...(options?.category && { category: options.category }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 100,
    });
  }

  private async createAlert(
    migrationId: string,
    data: { type: string; severity: string; message: string }
  ): Promise<Alert> {
    // Evitar alertas duplicadas recientes
    const recentAlert = await this.prisma.alert.findFirst({
      where: {
        migrationId,
        type: data.type,
        createdAt: { gte: new Date(Date.now() - 300000) }, // Últimos 5 minutos
      },
    });

    if (recentAlert) {
      return recentAlert;
    }

    const alert = await this.prisma.alert.create({
      data: {
        migrationId,
        type: data.type,
        severity: data.severity,
        message: data.message,
      },
    });

    // Emitir alerta vía Socket.IO
    if (migrationId) {
      getIO()?.to(`migration:${migrationId}`).emit('migration:alert', alert);
    }
    // También emitir al canal global de alertas para el badge del header
    getIO()?.emit('alerts:new', alert);

    // Enviar notificación externa si es error crítico
    if (data.type !== 'completed' && migrationId) {
      await this.notificationService.notifyMigrationAlert(migrationId, data.type, data.message);
    }

    return alert;
  }

  async getAlerts(options?: {
    migrationId?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<Alert[]> {
    return this.prisma.alert.findMany({
      where: {
        ...(options?.migrationId && { migrationId: options.migrationId }),
        ...(options?.acknowledged !== undefined && { acknowledged: options.acknowledged }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      include: {
        migration: true,
      },
    });
  }

  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.prisma.alert.update({
      where: { id: alertId },
      data: { acknowledged: true },
    });
  }

  // ==================== History / Deduplication ====================

  private async saveCompletedMigrationIds(migrationId: string): Promise<void> {
    try {
      const migration = await this.prisma.migration.findUnique({ where: { id: migrationId } });
      if (!migration?.csvFileName) return;

      const csvPath = require('path').join(process.cwd(), 'uploads', migration.csvFileName);
      try {
        await require('fs/promises').access(csvPath);
      } catch {
        return; // CSV ya no existe en disco
      }

      // Encontrar la columna mapeada como 'id'
      const mappings = JSON.parse(migration.mappings) as MappingConfig[];
      const idColumn = mappings.find((m) => m.mapper === 'id')?.field;
      if (!idColumn) return;

      const ids = await this.csvValidator.extractIds(csvPath, idColumn);
      if (ids.length === 0) return;

      // Guardar solo los que no existen ya
      const existing = await this.prisma.migratedItem.findMany({
        where: { itemId: { in: ids } },
        select: { itemId: true },
      });
      const existingSet = new Set(existing.map((e) => e.itemId));
      const newIds = ids.filter((id) => !existingSet.has(id));

      if (newIds.length > 0) {
        await this.prisma.migratedItem.createMany({
          data: newIds.map((itemId) => ({ itemId, migrationId, source: 'auto' })),
        });
      }

      await this.log(
        migrationId,
        'info',
        'system',
        `${newIds.length} IDs guardados en historial de deduplicación`
      );
    } catch (error) {
      console.error('Error saving migration IDs to history:', error);
    }
  }

  // ==================== Helpers ====================

  private async updateStatus(migrationId: string, status: string): Promise<void> {
    await this.prisma.migration.update({
      where: { id: migrationId },
      data: { status },
    });
  }

  // ==================== Stats History ====================

  async getStatsHistory(migrationId: string, limit: number = 200): Promise<StatsHistory[]> {
    return this.prisma.statsHistory.findMany({
      where: { migrationId },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });
  }

  // ==================== Report ====================

  async generateReportCSV(migrationId: string): Promise<string> {
    const migration = await this.prisma.migration.findUnique({ where: { id: migrationId } });
    if (!migration) throw new Error('Migración no encontrada');

    const logs = await this.getLogs(migrationId, { limit: 10000 });

    const duration =
      migration.startedAt && migration.completedAt
        ? Math.round(
            (migration.completedAt.getTime() - migration.startedAt.getTime()) / 60000
          ) + ' minutos'
        : 'N/A';

    const successRate =
      migration.successItems + migration.errorItems > 0
        ? Math.round(
            (migration.successItems / (migration.successItems + migration.errorItems)) * 100
          )
        : 100;

    const summaryLines = [
      `# REPORTE DE MIGRACIÓN — MigrAgent`,
      `# Nombre: ${migration.name}`,
      `# Estado: ${migration.status}`,
      `# Estrategia: ${migration.strategy}`,
      `# Archivo CSV: ${migration.csvFileName || 'N/A'}`,
      `# Total items: ${migration.totalItems}`,
      `# Exitosos: ${migration.successItems}`,
      `# Errores: ${migration.errorItems}`,
      `# Tasa de éxito: ${successRate}%`,
      `# Iniciada: ${migration.startedAt?.toISOString() || 'N/A'}`,
      `# Completada: ${migration.completedAt?.toISOString() || 'N/A'}`,
      `# Duración: ${duration}`,
      `# Reintentos: ${migration.currentRetryCount} / ${migration.maxRetries}`,
      `# Generado: ${new Date().toISOString()}`,
      `#`,
      `timestamp,level,category,message`,
    ].join('\n');

    const logRows = logs
      .map(
        (l) =>
          `"${l.createdAt.toISOString()}","${l.level}","${l.category}","${l.message.replace(/"/g, '""')}"`
      )
      .join('\n');

    return summaryLines + '\n' + logRows;
  }

  async getValidationResult(migrationId: string): Promise<CSVValidationResult | null> {
    const result = await this.prisma.validationResult.findFirst({
      where: { migrationId },
      orderBy: { createdAt: 'desc' },
    });

    if (!result) return null;

    return {
      isValid: result.isValid,
      totalRows: result.totalRows,
      validRows: result.validRows,
      errorRows: result.errorRows,
      warningRows: result.warningRows,
      errors: JSON.parse(result.errors),
      warnings: JSON.parse(result.warnings),
      urlDetails: result.urlDetails ? JSON.parse(result.urlDetails) : [],
      duplicates: result.duplicates ? JSON.parse(result.duplicates) : [],
      emptyFields: result.emptyFields ? JSON.parse(result.emptyFields) : {},
      preview: [],
    };
  }
}
