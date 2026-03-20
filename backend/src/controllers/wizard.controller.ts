import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MediastreamService } from '../services/mediastream.service.js';
import { MappingConfig } from '../types/index.js';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();
const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');

export class WizardController {
  // POST /api/wizard/create
  // Crea la migración en helpperMigrator DB y luego en Mediastream, usando el CSV normalizado
  static async createMigration(req: Request, res: Response) {
    const {
      name,
      strategy,
      mappings,
      normalizedTempId,
      templateId,
    } = req.body as {
      name: string;
      strategy: 'transcode' | 'upload';
      mappings: MappingConfig[];
      normalizedTempId: string;
      templateId?: string;
    };

    if (!name || !strategy || !mappings || !normalizedTempId) {
      return res.status(400).json({ error: 'Parámetros incompletos' });
    }

    // Verificar que el CSV normalizado existe
    const csvPath = path.join(TEMP_DIR, `${normalizedTempId}.csv`);
    try {
      await fs.access(csvPath);
    } catch {
      return res.status(404).json({ error: 'CSV normalizado no encontrado. Vuelve al paso de mapeo.' });
    }

    // 1. Crear registro en DB local
    const migration = await prisma.migration.create({
      data: {
        name,
        strategy,
        mappings: JSON.stringify(mappings),
        templateId: templateId ?? null,
        status: 'created',
        csvFileName: `normalized-${normalizedTempId}.csv`,
      },
    });

    // 2. Crear en Mediastream usando sesión activa
    const ms = await MediastreamService.fromActiveSession();
    const msConfig = await ms.createMigration({ name, strategy, mappings });

    // 3. Actualizar con el ID de Mediastream
    await prisma.migration.update({
      where: { id: migration.id },
      data: {
        mediastreamConfigId: msConfig._id,
        status: 'validated',
      },
    });

    // 4. Mover CSV de temp a uploads permanente
    const finalPath = path.join(process.cwd(), 'uploads', `${migration.id}.csv`);
    await fs.copyFile(csvPath, finalPath);

    // 5. Log
    await prisma.migrationLog.create({
      data: {
        migrationId: migration.id,
        level: 'info',
        category: 'wizard',
        message: `Migración creada vía wizard. SM2 ID: ${msConfig._id}`,
      },
    });

    res.json({
      migrationId: migration.id,
      mediastreamId: msConfig._id,
    });
  }
}
