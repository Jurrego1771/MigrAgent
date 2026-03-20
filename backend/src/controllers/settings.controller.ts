import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { MediastreamService } from '../services/mediastream.service.js';

const prisma = new PrismaClient();
const mediastreamService = new MediastreamService();

export class SettingsController {
  // GET /api/settings
  static async get(req: Request, res: Response) {
    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: { id: 'default' },
      });
    }

    res.json(settings);
  }

  // PUT /api/settings
  static async update(req: Request, res: Response) {
    const data = req.body;

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });

    res.json(settings);
  }

  // POST /api/settings/test-connection
  static async testConnection(req: Request, res: Response) {
    const result = await mediastreamService.testConnection();
    res.json(result);
  }

  // GET /api/settings/mediastream-migrations
  static async getMediastreamMigrations(req: Request, res: Response) {
    try {
      const migrations = await mediastreamService.listMigrations();
      res.json(migrations);
    } catch (error) {
      res.status(500).json({
        error: 'Error al obtener migraciones de Mediastream',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}
