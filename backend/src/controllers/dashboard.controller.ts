import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class DashboardController {
  /**
   * GET /api/dashboard/metrics
   * Agrega métricas globales de todas las migraciones para el dashboard.
   */
  static async getMetrics(req: Request, res: Response): Promise<void> {
    const [migrations, recentMigrations] = await Promise.all([
      prisma.migration.findMany({
        select: {
          status: true,
          processedItems: true,
          errorItems: true,
          totalItems: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.migration.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          name: true,
          status: true,
          processedItems: true,
          totalItems: true,
          errorItems: true,
          createdAt: true,
          strategy: true,
        },
      }),
    ]);

    // ── 1. Por estado ────────────────────────────────────────────────────────
    const byStatus: Record<string, number> = {};
    for (const m of migrations) {
      byStatus[m.status] = (byStatus[m.status] || 0) + 1;
    }

    // ── 2. Items totales ─────────────────────────────────────────────────────
    const totalItemsMigrated = migrations.reduce((acc, m) => acc + m.processedItems, 0);
    const totalItemsWithErrors = migrations.reduce((acc, m) => acc + m.errorItems, 0);
    const successRate =
      totalItemsMigrated + totalItemsWithErrors > 0
        ? Math.round((totalItemsMigrated / (totalItemsMigrated + totalItemsWithErrors)) * 100)
        : null;

    // ── 3. Actividad últimos 7 días (migraciones creadas + completadas) ──────
    const activity: { date: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);

      const created = migrations.filter(
        (m) => m.createdAt.toISOString().slice(0, 10) === day
      ).length;

      const completed = migrations.filter(
        (m) => m.status === 'done' && m.updatedAt.toISOString().slice(0, 10) === day
      ).length;

      activity.push({ date: day, created, completed });
    }

    // ── 4. Templates más usados ──────────────────────────────────────────────
    const templates = await prisma.template.findMany({
      orderBy: { usageCount: 'desc' },
      take: 5,
      select: { id: true, name: true, usageCount: true, strategy: true },
    });

    res.json({
      totalMigrations: migrations.length,
      byStatus,
      totalItemsMigrated,
      totalItemsWithErrors,
      successRate,
      activity,
      recentMigrations,
      topTemplates: templates,
    });
  }
}
