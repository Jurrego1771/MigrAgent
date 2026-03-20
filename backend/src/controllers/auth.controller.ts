import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';

export class AuthController {
  /**
   * POST /api/auth/login
   * Inicia sesión en SM2 y persiste la sesión cifrada.
   */
  static async login(req: Request, res: Response): Promise<void> {
    const { email, password, apiUrl, totp } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email y password son requeridos.' });
      return;
    }

    try {
      const session = await AuthService.login({ email, password, apiUrl, totp });
      res.json({ success: true, session });
    } catch (err: any) {
      const status = err.code === 'TOTP_REQUIRED' ? 428 : 401;
      res.status(status).json({
        success: false,
        error: err.message,
        code: err.code,
      });
    }
  }

  /**
   * GET /api/auth/session
   * Devuelve la sesión activa actual (sin credenciales).
   */
  static async getSession(req: Request, res: Response): Promise<void> {
    const session = await AuthService.getActiveSession();
    if (!session) {
      res.status(404).json({ session: null, authenticated: false });
      return;
    }
    res.json({ authenticated: true, session });
  }

  /**
   * GET /api/auth/sessions
   * Lista todas las sesiones (historial).
   */
  static async listSessions(req: Request, res: Response): Promise<void> {
    const sessions = await AuthService.listSessions();
    res.json({ sessions });
  }

  /**
   * POST /api/auth/validate
   * Verifica contra SM2 si la sesión activa sigue siendo válida.
   */
  static async validate(req: Request, res: Response): Promise<void> {
    const result = await AuthService.validateActiveSession();
    const status = result.valid ? 200 : 401;
    res.status(status).json(result);
  }

  /**
   * DELETE /api/auth/session
   * Cierra la sesión activa actual.
   */
  static async logout(req: Request, res: Response): Promise<void> {
    await AuthService.logout();
    res.json({ success: true });
  }

  /**
   * DELETE /api/auth/sessions/:id
   * Revoca una sesión específica por ID.
   */
  static async revokeSession(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    await AuthService.revokeSession(id);
    res.json({ success: true });
  }
}
