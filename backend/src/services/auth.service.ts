import crypto from 'crypto';
import axios from 'axios';
import { PrismaClient, AuthSession } from '@prisma/client';
import { config } from '../config/index.js';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Cifrado AES-256-GCM
// Formato almacenado: iv_hex:authTag_hex:ciphertext_hex
// ---------------------------------------------------------------------------

function getEncryptionKey(): Buffer {
  const hex = config.sessionEncryptionKey;
  if (hex.length !== 64) {
    throw new Error(
      'SESSION_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes).'
    );
  }
  return Buffer.from(hex, 'hex');
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96 bits — recomendado para GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

function decrypt(stored: string): string {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de credencial cifrada inválido.');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  } catch {
    throw new Error('No se pudo descifrar la credencial. La clave de cifrado puede haber cambiado.');
  }
}

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface LoginParams {
  email: string;
  password: string;
  apiUrl?: string;
  totp?: string; // Código TOTP si la cuenta tiene 2FA
}

export interface SessionInfo {
  id: string;
  accountId: string;
  accountName: string | null;
  userEmail: string;
  apiUrl: string;
  expiresAt: Date;
  isActive: boolean;
  createdAt: Date;
  // Las credenciales nunca se exponen en la respuesta pública
}

export interface DecryptedSession {
  id: string;
  accountId: string;
  apiUrl: string;
  jwt: string;
  sid: string;
}

// ---------------------------------------------------------------------------
// AuthService
// ---------------------------------------------------------------------------

export class AuthService {
  /**
   * Inicia sesión en SM2, extrae JWT + connect.sid y los persiste cifrados.
   * Desactiva cualquier sesión previa activa para la misma cuenta/URL.
   */
  static async login(params: LoginParams): Promise<SessionInfo> {
    const apiUrl = params.apiUrl || config.mediastream.apiUrl;

    // SM2 POST /login acepta { username, password } (puede ser email o nombre de usuario)
    const loginBody: Record<string, string> = {
      username: params.email,
      password: params.password,
    };
    if (params.totp) {
      loginBody.totp = params.totp;
    }

    let jwt: string;
    let sid: string;
    let accountId: string;
    let accountName: string | undefined;
    let userEmail: string;
    let expiresAt: Date;

    try {
      // SM2 usa POST /login (web form), no una REST API.
      // Debemos capturar el connect.sid del redirect y luego
      // obtener el JWT desde una cookie que SM2 inyecta en respuestas autenticadas.
      const loginResponse = await axios.post(
        `${apiUrl}/login`,
        loginBody,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 15000,
          maxRedirects: 0,              // no seguir redirect — necesitamos los headers
          validateStatus: (s) => s < 500, // aceptar 302
        }
      );

      // Detectar TOTP: SM2 redirige a /login/totp cuando está habilitado
      const location = loginResponse.headers['location'] || '';
      if (location.includes('/login/totp')) {
        const totpError = new Error('Esta cuenta requiere código TOTP (2FA).');
        (totpError as any).code = 'TOTP_REQUIRED';
        throw totpError;
      }

      // Detectar credenciales inválidas: SM2 redirige a /?loginerror
      if (location.includes('loginerror') || location.includes('errorInvalidIp')) {
        throw new Error('Credenciales incorrectas. Verifica usuario y contraseña.');
      }

      // Capturar connect.sid del Set-Cookie del login
      sid = AuthService._extractConnectSid(loginResponse.headers['set-cookie']);

      if (!sid) {
        throw new Error(
          'SM2 no devolvió una cookie connect.sid. Verifica que el servidor de sesiones esté activo.'
        );
      }

      // Obtener el JWT: SM2 lo inyecta como cookie 'jwt' al responder a rutas autenticadas.
      // Llamamos /api/account con la sesión recién creada para recibirlo.
      const accountResponse = await axios.get(`${apiUrl}/api/account`, {
        headers: { Cookie: `connect.sid=${sid}` },
        timeout: 10000,
        validateStatus: () => true,
      });

      // El JWT viene en la cookie 'jwt' del response
      jwt = AuthService._extractCookieValue('jwt', accountResponse.headers['set-cookie']);

      // Fallback: a veces viene en x-api-token o en el body
      if (!jwt) {
        jwt =
          accountResponse.data?.token ||
          accountResponse.data?.jwt ||
          '';
      }

      if (!jwt) {
        throw new Error(
          'No se pudo obtener el JWT de SM2. La sesión puede haber expirado inmediatamente o el usuario no tiene permisos suficientes.'
        );
      }

      // Extraer info del usuario desde el payload del JWT
      const payload = AuthService._decodeJwtPayload(jwt);
      accountId = String(payload?.account || '');
      userEmail = String(payload?.email || params.email);

      const exp = payload?.exp;
      expiresAt =
        typeof exp === 'number'
          ? new Date(exp * 1000)
          : new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Obtener nombre de cuenta desde la respuesta de /api/account
      accountName =
        accountResponse.data?.account?.name ||
        accountResponse.data?.data?.account?.name ||
        undefined;

      if (!accountId) {
        accountId =
          String(accountResponse.data?.account?._id || '') ||
          String(accountResponse.data?.data?.account?._id || '');
      }
    } catch (err: any) {
      if ((err as any).code === 'TOTP_REQUIRED') throw err;
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 401 || status === 403) {
          throw new Error('Credenciales incorrectas. Verifica email y contraseña.');
        }
      }
      throw err;
    }

    // Desactivar sesiones previas para la misma cuenta en la misma URL
    await prisma.authSession.updateMany({
      where: { accountId, apiUrl, isActive: true },
      data: { isActive: false },
    });

    // Persistir con credenciales cifradas
    const session = await prisma.authSession.create({
      data: {
        accountId,
        accountName: accountName || null,
        userEmail,
        encryptedJwt: encrypt(jwt),
        encryptedSid: encrypt(sid),
        apiUrl,
        expiresAt,
        isActive: true,
      },
    });

    return AuthService._toPublic(session);
  }

  /**
   * Devuelve la sesión activa más reciente.
   * Valida que no esté expirada. Si está expirada, la desactiva y retorna null.
   */
  static async getActiveSession(): Promise<SessionInfo | null> {
    const session = await prisma.authSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      return null;
    }

    return AuthService._toPublic(session);
  }

  /**
   * Devuelve todas las sesiones (activas e inactivas) para mostrar historial.
   */
  static async listSessions(): Promise<SessionInfo[]> {
    const sessions = await prisma.authSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return sessions.map(AuthService._toPublic);
  }

  /**
   * Valida que la sesión activa siga siendo válida en SM2.
   * Hace un GET /api/auth/token y actualiza expiresAt si sigue activa.
   */
  static async validateActiveSession(): Promise<{
    valid: boolean;
    session: SessionInfo | null;
    reason?: string;
  }> {
    const session = await prisma.authSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return { valid: false, session: null, reason: 'No hay sesión activa.' };
    }

    if (session.expiresAt < new Date()) {
      await prisma.authSession.update({
        where: { id: session.id },
        data: { isActive: false },
      });
      return {
        valid: false,
        session: null,
        reason: 'La sesión ha expirado. Inicia sesión nuevamente.',
      };
    }

    // Verificar contra SM2
    let jwt: string;
    let sid: string;
    try {
      jwt = decrypt(session.encryptedJwt);
      sid = decrypt(session.encryptedSid);
    } catch {
      return {
        valid: false,
        session: null,
        reason: 'Error al descifrar las credenciales almacenadas.',
      };
    }

    try {
      // Validar la sesión contra SM2 llamando a un endpoint autenticado
      const checkResponse = await axios.get(`${session.apiUrl}/api/account`, {
        headers: {
          'x-api-token': jwt,
          Cookie: `connect.sid=${sid}`,
        },
        timeout: 10000,
        validateStatus: (s) => s < 500,
      });
      if (checkResponse.status === 403 || checkResponse.status === 401) {
        await prisma.authSession.update({
          where: { id: session.id },
          data: { isActive: false },
        });
        return { valid: false, session: null, reason: 'Token revocado por SM2. Inicia sesión nuevamente.' };
      }
      return { valid: true, session: AuthService._toPublic(session) };
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        await prisma.authSession.update({
          where: { id: session.id },
          data: { isActive: false },
        });
        return {
          valid: false,
          session: null,
          reason: 'Token o sesión revocado por SM2. Inicia sesión nuevamente.',
        };
      }
      // Error de red — no invalidar, podría ser transitorio
      return {
        valid: true,
        session: AuthService._toPublic(session),
      };
    }
  }

  /**
   * Desactiva la sesión activa actual (logout).
   */
  static async logout(): Promise<void> {
    await prisma.authSession.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
  }

  /**
   * Desactiva una sesión específica por ID.
   */
  static async revokeSession(sessionId: string): Promise<void> {
    await prisma.authSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
  }

  /**
   * Decodifica el payload del JWT almacenado y retorna los módulos de la cuenta.
   * Los módulos vienen en accountScope del JWT de SM2.
   */
  static async getModulesFromSession(): Promise<Record<string, boolean>> {
    const session = await prisma.authSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!session) return {};
    try {
      const jwt = decrypt(session.encryptedJwt);
      const payload = AuthService._decodeJwtPayload(jwt) as Record<string, unknown>;
      const scope = payload?.accountScope;
      if (scope && typeof scope === 'object') {
        return scope as Record<string, boolean>;
      }
    } catch {
      // ignorar errores de descifrado
    }
    return {};
  }

  /**
   * Devuelve las credenciales descifradas de la sesión activa.
   * Uso interno — nunca exponer al frontend.
   */
  static async getDecryptedSession(): Promise<DecryptedSession | null> {
    const session = await prisma.authSession.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!session || session.expiresAt < new Date()) return null;

    try {
      return {
        id: session.id,
        accountId: session.accountId,
        apiUrl: session.apiUrl,
        jwt: decrypt(session.encryptedJwt),
        sid: decrypt(session.encryptedSid),
      };
    } catch {
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers privados
  // ---------------------------------------------------------------------------

  private static _extractConnectSid(setCookieHeader: string | string[] | undefined): string {
    return AuthService._extractCookieValue('connect.sid', setCookieHeader);
  }

  private static _extractCookieValue(
    name: string,
    setCookieHeader: string | string[] | undefined
  ): string {
    if (!setCookieHeader) return '';
    const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    const escapedName = name.replace('.', '\\.');
    const re = new RegExp(`${escapedName}=([^;]+)`);
    for (const cookie of cookies) {
      const match = cookie.match(re);
      if (match) return decodeURIComponent(match[1]);
    }
    return '';
  }

  private static _decodeJwtPayload(token: string): Record<string, unknown> {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return {};
      const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
      return JSON.parse(payload);
    } catch {
      return {};
    }
  }

  private static _toPublic(session: AuthSession): SessionInfo {
    return {
      id: session.id,
      accountId: session.accountId,
      accountName: session.accountName,
      userEmail: session.userEmail,
      apiUrl: session.apiUrl,
      expiresAt: session.expiresAt,
      isActive: session.isActive,
      createdAt: session.createdAt,
    };
  }
}
