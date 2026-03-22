import { Request, Response } from 'express';
import { MigrationService } from '../services/migration.service.js';
import { MappingConfig, RetryPolicy } from '../types/index.js';
import prisma from '../lib/prisma.js';

const migrationService = new MigrationService(prisma);

export class MigrationController {
  // GET /api/migrations
  static async list(req: Request, res: Response) {
    const migrations = await migrationService.list();
    res.json(migrations);
  }

  // GET /api/migrations/:id
  static async getById(req: Request, res: Response) {
    const { id } = req.params;
    const migration = await migrationService.getById(id);

    if (!migration) {
      return res.status(404).json({ error: 'Migración no encontrada' });
    }

    res.json(migration);
  }

  // POST /api/migrations
  static async create(req: Request, res: Response) {
    const { name, strategy, mappings, templateId, retryPolicy } = req.body as {
      name: string;
      strategy: 'transcode' | 'upload';
      mappings: MappingConfig[];
      templateId?: string;
      retryPolicy?: RetryPolicy;
    };

    if (!name || !strategy || !mappings) {
      return res.status(400).json({ error: 'Nombre, estrategia y mappings son requeridos' });
    }

    const migration = await migrationService.create({
      name,
      strategy,
      mappings,
      templateId,
      retryPolicy,
    });

    res.status(201).json(migration);
  }

  // PUT /api/migrations/:id
  static async update(req: Request, res: Response) {
    const { id } = req.params;
    const { name, mappings, retryPolicy } = req.body;

    const migration = await migrationService.update(id, { name, mappings, retryPolicy });
    res.json(migration);
  }

  // DELETE /api/migrations/:id
  static async delete(req: Request, res: Response) {
    const { id } = req.params;
    await migrationService.delete(id);
    res.status(204).send();
  }

  // POST /api/migrations/:id/validate
  static async validate(req: Request, res: Response) {
    const { id } = req.params;
    const file = req.file;
    const { checkUrls } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Archivo CSV requerido' });
    }

    const result = await migrationService.validateCSV(id, file.path, {
      checkUrls: checkUrls !== 'false',
    });

    res.json(result);
  }

  // GET /api/migrations/:id/validation
  static async getValidation(req: Request, res: Response) {
    const { id } = req.params;
    const result = await migrationService.getValidationResult(id);

    if (!result) {
      return res.status(404).json({ error: 'No hay resultados de validación' });
    }

    res.json(result);
  }

  // POST /api/migrations/:id/create-in-mediastream
  static async createInMediastream(req: Request, res: Response) {
    const { id } = req.params;
    const mediastreamId = await migrationService.createInMediastream(id);
    res.json({ mediastreamId });
  }

  // POST /api/migrations/:id/start
  static async start(req: Request, res: Response) {
    const { id } = req.params;
    await migrationService.start(id);
    res.json({ success: true });
  }

  // POST /api/migrations/:id/stop
  static async stop(req: Request, res: Response) {
    const { id } = req.params;
    await migrationService.stop(id);
    res.json({ success: true });
  }

  // POST /api/migrations/:id/retry
  static async retry(req: Request, res: Response) {
    const { id } = req.params;
    await migrationService.retry(id);
    res.json({ success: true });
  }

  // POST /api/migrations/:id/resume
  static async resume(req: Request, res: Response) {
    const { id } = req.params;
    const result = await migrationService.resume(id);
    res.json({ success: true, fromRow: result.fromRow });
  }

  // GET /api/migrations/:id/stats
  static async getStats(req: Request, res: Response) {
    const { id } = req.params;
    const stats = await migrationService.getStats(id);

    if (!stats) {
      return res.status(404).json({ error: 'Estadísticas no disponibles' });
    }

    res.json(stats);
  }

  // GET /api/migrations/:id/logs
  static async getLogs(req: Request, res: Response) {
    const { id } = req.params;
    const { level, category, limit } = req.query;

    const logs = await migrationService.getLogs(id, {
      level: level ? (level as string).split(',') : undefined,
      category: category as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(logs);
  }

  // GET /api/migrations/:id/stats-history
  static async getStatsHistory(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
    const history = await migrationService.getStatsHistory(id, limit);
    res.json(history);
  }

  // GET /api/migrations/:id/report/csv
  static async downloadReport(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const migration = await migrationService.getById(id);

    if (!migration) {
      return res.status(404).json({ error: 'Migración no encontrada' });
    }

    const csv = await migrationService.generateReportCSV(id);
    const filename = `reporte-${migration.name.replace(/[^a-z0-9]/gi, '_')}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM para compatibilidad con Excel
  }
}
