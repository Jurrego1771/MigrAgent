import { Request, Response } from 'express';
import { MigrationService } from '../services/migration.service.js';
import prisma from '../lib/prisma.js';

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
    await migrationService.acknowledgeAllAlerts(migrationId as string | undefined);
    res.json({ success: true });
  }

  // GET /api/alerts/unread-count
  static async getUnreadCount(req: Request, res: Response) {
    const count = await migrationService.getUnreadAlertCount();
    res.json({ count });
  }
}
