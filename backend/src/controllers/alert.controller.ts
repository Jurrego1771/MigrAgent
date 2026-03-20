import { Request, Response } from 'express';
import { MigrationService } from '../services/migration.service.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const migrationService = new MigrationService(prisma);

export class AlertController {
  // GET /api/alerts
  static async list(req: Request, res: Response) {
    const { migrationId, acknowledged, limit } = req.query;

    const alerts = await migrationService.getAlerts({
      migrationId: migrationId as string,
      acknowledged: acknowledged ? acknowledged === 'true' : undefined,
      limit: limit ? parseInt(limit as string, 10) : undefined,
    });

    res.json(alerts);
  }

  // PUT /api/alerts/:id/acknowledge
  static async acknowledge(req: Request, res: Response) {
    const { id } = req.params;
    await migrationService.acknowledgeAlert(id);
    res.json({ success: true });
  }

  // PUT /api/alerts/acknowledge-all
  static async acknowledgeAll(req: Request, res: Response) {
    const { migrationId } = req.body;

    await prisma.alert.updateMany({
      where: {
        acknowledged: false,
        ...(migrationId && { migrationId }),
      },
      data: { acknowledged: true },
    });

    res.json({ success: true });
  }

  // GET /api/alerts/unread-count
  static async getUnreadCount(req: Request, res: Response) {
    const count = await prisma.alert.count({
      where: { acknowledged: false },
    });

    res.json({ count });
  }
}
