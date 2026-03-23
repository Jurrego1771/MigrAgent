import { Request, Response } from 'express';
import { MediastreamService } from '../services/mediastream.service.js';
import { CSVValidatorService } from '../services/csv-validator.service.js';
import { TemplateService } from '../services/template.service.js';
import { MappingConfig, TransformationRule, BatchConfig } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma.js';

const csvValidator = new CSVValidatorService();
const templateService = new TemplateService(prisma);
const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * Builds the complete keys + mappings + sample payload for SM2.
 *
 * SM2 requires:
 *   - keys[]     : every CSV column header
 *   - mappings[] : one entry per column (using field "mapping" not "mapper")
 *   - sample[]   : a few sample rows so SM2 can preview the data
 *
 * Unmapped columns use the operator workaround: map to "published" with an
 * impossible condition (publishedMatch = random token that will never match a
 * real value) so SM2 treats those items as not-published without rejecting them.
 */
async function buildSM2MigrationPayload(
  csvPath: string,
  userMappings: MappingConfig[]
): Promise<{ keys: string[]; mappings: MappingConfig[]; sample: Record<string, string>[] }> {
  const [headers, sample] = await Promise.all([
    csvValidator.getHeaders(csvPath),
    csvValidator.getSampleRows(csvPath, 8),
  ]);

  const mappedFields = new Set(userMappings.map((m) => m.field));
  const fullMappings: MappingConfig[] = [...userMappings];

  for (const header of headers) {
    if (!mappedFields.has(header)) {
      // Operator workaround: map to "published" with a condition that never
      // matches so SM2 accepts the column without changing publish status.
      fullMappings.push({
        mapper: 'published',
        field: header,
        options: [
          { key: 'publishedStatus', val: false },
          { key: 'publishedMatch', val: `NO_MATCH_${Date.now()}` },
        ] as unknown as Record<string, unknown>,
      });
    }
  }

  return { keys: headers, mappings: fullMappings, sample };
}

export class WizardController {
  // POST /api/wizard/create
  static async createMigration(req: Request, res: Response) {
    const {
      name,
      strategy,
      mappings,
      normalizedTempId,
      templateId,
      transformationRules,
      batchConfig,
      saveAsTemplate,
    } = req.body as {
      name: string;
      strategy: 'transcode' | 'upload';
      mappings: MappingConfig[];
      normalizedTempId: string;
      templateId?: string;
      transformationRules?: TransformationRule[];
      batchConfig?: BatchConfig;
      saveAsTemplate?: { name: string; expectedHeaders: string[] };
    };

    if (!name || !strategy || !mappings || !normalizedTempId) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    const csvPath = path.join(TEMP_DIR, `${normalizedTempId}.csv`);
    try {
      await fs.access(csvPath);
    } catch {
      return res.status(404).json({ error: 'CSV normalizado no encontrado. Vuelve al paso de mapeo.' });
    }

    const ms = await MediastreamService.fromActiveSession();

    // ── MIGRACIÓN POR LOTES ─────────────────────────────────────────────────
    if (batchConfig?.enabled && batchConfig.size > 0) {
      // Resolve template before batch creation
      let batchTemplateId = templateId ?? null;
      if (saveAsTemplate?.name) {
        const tpl = await templateService.create({
          name: saveAsTemplate.name,
          strategy,
          mappings,
          expectedHeaders: saveAsTemplate.expectedHeaders || [],
        });
        batchTemplateId = tpl.id;
      } else if (templateId) {
        await templateService.incrementUsage(templateId).catch((err) => console.error('Error incrementing template usage:', err));
      }
      return WizardController._createBatchMigrations(res, {
        name,
        strategy,
        mappings,
        csvPath,
        normalizedTempId,
        templateId: batchTemplateId ?? undefined,
        transformationRules,
        batchConfig,
        ms,
      });
    }

    // ── GUARDAR COMO TEMPLATE (antes de crear migración) ────────────────────
    let resolvedTemplateId = templateId ?? null;
    if (saveAsTemplate?.name) {
      const tpl = await templateService.create({
        name: saveAsTemplate.name,
        strategy,
        mappings,
        expectedHeaders: saveAsTemplate.expectedHeaders || [],
      });
      resolvedTemplateId = tpl.id;
    } else if (templateId) {
      // Incrementar uso del template detectado
      await templateService.incrementUsage(templateId).catch((err) => console.error('Error incrementing template usage:', err));
    }

    // ── MIGRACIÓN SIMPLE ────────────────────────────────────────────────────
    const migration = await prisma.migration.create({
      data: {
        name,
        strategy,
        mappings: JSON.stringify(mappings),
        transformationRules: transformationRules ? JSON.stringify(transformationRules) : null,
        templateId: resolvedTemplateId,
        status: 'created',
        csvFileName: `normalized-${normalizedTempId}.csv`,
      },
    });

    const sm2Payload = await buildSM2MigrationPayload(csvPath, mappings);
    const msConfig = await ms.createMigration({ name, strategy, ...sm2Payload });

    await prisma.migration.update({
      where: { id: migration.id },
      data: { mediastreamConfigId: msConfig._id, status: 'validated' },
    });

    const finalPath = path.join(UPLOADS_DIR, `${migration.id}.csv`);
    await fs.copyFile(csvPath, finalPath);

    await prisma.migrationLog.create({
      data: {
        migrationId: migration.id,
        level: 'info',
        category: 'wizard',
        message: `Migración creada vía wizard. SM2 ID: ${msConfig._id}`,
      },
    });

    res.json({ migrationId: migration.id, mediastreamId: msConfig._id });
  }

  // ── Lógica de lotes ──────────────────────────────────────────────────────
  private static async _createBatchMigrations(
    res: Response,
    opts: {
      name: string;
      strategy: 'transcode' | 'upload';
      mappings: MappingConfig[];
      csvPath: string;
      normalizedTempId: string;
      templateId?: string;
      transformationRules?: TransformationRule[];
      batchConfig: BatchConfig;
      ms: MediastreamService;
    }
  ) {
    const {
      name, strategy, mappings, csvPath, normalizedTempId,
      templateId, transformationRules, batchConfig, ms,
    } = opts;

    const prefix = batchConfig.namePrefix || name;
    const batchGroupId = uuidv4();

    // Pre-build the SM2 payload (same keys/mappings for all batches)
    const batchSM2Payload = await buildSM2MigrationPayload(csvPath, mappings);

    // 1. Dividir el CSV
    const { paths: batchPaths, rowCounts } = await csvValidator.splitCSV(
      csvPath,
      TEMP_DIR,
      batchConfig.size
    );
    const totalBatches = batchPaths.length;

    const createdBatches: Array<{ migrationId: string; mediastreamId: string; index: number; rowCount: number }> = [];

    for (let i = 0; i < totalBatches; i++) {
      const batchIndex = i + 1;
      const batchName = `${prefix} - Lote ${batchIndex}/${totalBatches}`;
      const batchCsvPath = batchPaths[i];

      // Solo el primer lote queda en 'validated'; el resto en 'created' (esperando)
      const initialStatus = i === 0 ? 'validated' : 'created';

      const migration = await prisma.migration.create({
        data: {
          name: batchName,
          strategy,
          mappings: JSON.stringify(mappings),
          transformationRules: transformationRules ? JSON.stringify(transformationRules) : null,
          templateId: templateId ?? null,
          status: initialStatus,
          csvFileName: `batch-${batchGroupId}-${batchIndex}.csv`,
          batchGroupId,
          batchIndex,
          batchTotal: totalBatches,
          batchSize: batchConfig.size,
          batchNamePrefix: prefix,
          batchMode: batchConfig.mode,
        },
      });

      // Crear en SM2
      const msConfig = await ms.createMigration({ name: batchName, strategy, ...batchSM2Payload });

      await prisma.migration.update({
        where: { id: migration.id },
        data: { mediastreamConfigId: msConfig._id },
      });

      // Mover CSV del lote a uploads permanente
      const finalBatchPath = path.join(UPLOADS_DIR, `batch-${batchGroupId}-${batchIndex}.csv`);
      await fs.copyFile(batchCsvPath, finalBatchPath);
      await fs.unlink(batchCsvPath).catch(() => {});

      await prisma.migrationLog.create({
        data: {
          migrationId: migration.id,
          level: 'info',
          category: 'wizard',
          message: `Lote ${batchIndex}/${totalBatches} creado vía wizard. SM2 ID: ${msConfig._id}. Modo: ${batchConfig.mode}.`,
        },
      });

      createdBatches.push({
        migrationId: migration.id,
        mediastreamId: msConfig._id ?? '',
        index: batchIndex,
        rowCount: rowCounts[i],
      });
    }

    res.json({
      isBatch: true,
      batchGroupId,
      totalBatches,
      batches: createdBatches,
      // Alias de conveniencia: primer lote
      migrationId: createdBatches[0].migrationId,
      mediastreamId: createdBatches[0].mediastreamId,
    });
  }
}
