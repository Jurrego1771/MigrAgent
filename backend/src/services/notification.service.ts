import axios from 'axios';
import { PrismaClient } from '@prisma/client';

export class NotificationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async notifyMigrationComplete(
    migrationId: string,
    stats: { done: number; error: number }
  ): Promise<void> {
    const [settings, migration] = await Promise.all([
      this.prisma.settings.findUnique({ where: { id: 'default' } }),
      this.prisma.migration.findUnique({ where: { id: migrationId } }),
    ]);

    if (!settings?.notifyOnComplete || !migration) return;

    const successRate =
      stats.done + stats.error > 0
        ? Math.round((stats.done / (stats.done + stats.error)) * 100)
        : 100;

    const subject = `Migración "${migration.name}" completada`;
    const body = [
      `La migración "${migration.name}" ha finalizado.`,
      '',
      `✅ Exitosos: ${stats.done}`,
      `❌ Errores:  ${stats.error}`,
      `📊 Tasa de éxito: ${successRate}%`,
    ].join('\n');

    if (settings.notificationEmail) {
      await this.sendEmail(settings.notificationEmail, subject, body);
    }

    if (settings.notificationWebhookUrl) {
      await this.sendWebhook(settings.notificationWebhookUrl, {
        event: 'migration.complete',
        migrationId,
        migrationName: migration.name,
        stats: { ...stats, successRate },
        timestamp: new Date().toISOString(),
      });
    }
  }

  async notifyMigrationAlert(
    migrationId: string,
    alertType: string,
    message: string
  ): Promise<void> {
    const [settings, migration] = await Promise.all([
      this.prisma.settings.findUnique({ where: { id: 'default' } }),
      this.prisma.migration.findUnique({ where: { id: migrationId } }),
    ]);

    if (!settings?.notifyOnError || !migration) return;

    const subject = `Alerta en migración "${migration.name}": ${alertType}`;

    if (settings.notificationEmail) {
      await this.sendEmail(settings.notificationEmail, subject, message);
    }

    if (settings.notificationWebhookUrl) {
      await this.sendWebhook(settings.notificationWebhookUrl, {
        event: 'migration.alert',
        alertType,
        migrationId,
        migrationName: migration.name,
        message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private async sendEmail(to: string, subject: string, text: string): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || smtpUser;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(`[Notification] Email skipped — SMTP not configured. Subject: ${subject}`);
      return;
    }

    try {
      // nodemailer loaded dynamically to avoid hard dependency at startup
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.default.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({ from: smtpFrom, to, subject, text });
      console.log(`[Notification] Email sent to ${to}`);
    } catch (err) {
      console.error('[Notification] Email send failed:', err);
    }
  }

  private async sendWebhook(url: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await axios.post(url, payload, {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MigrAgent/1.0',
        },
      });
      console.log(`[Notification] Webhook sent to ${url}`);
    } catch (err) {
      console.error('[Notification] Webhook send failed:', err);
    }
  }
}
