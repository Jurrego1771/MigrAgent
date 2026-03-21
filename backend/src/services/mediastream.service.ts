import axios, { AxiosInstance, AxiosError } from 'axios';
import { config } from '../config/index.js';
import { AuthService } from './auth.service.js';
import {
  MediastreamMigrationConfig,
  MediastreamStats,
  MediastreamJob,
  MappingConfig,
} from '../types/index.js';

export interface MediastreamCredentials {
  apiUrl: string;
  jwt: string;
  sid: string;
  accountId: string;
}

export class MediastreamService {
  private client: AxiosInstance;
  private accountId: string;

  constructor(credentials?: MediastreamCredentials) {
    // Prioridad: credenciales explícitas → sesión BD → variables de entorno (legacy)
    const jwt = credentials?.jwt || config.mediastream.apiToken;
    const sid = credentials?.sid || config.mediastream.sessionCookie;
    const baseURL = credentials?.apiUrl || config.mediastream.apiUrl;
    const accountId = credentials?.accountId || config.mediastream.accountId;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // SM2 salta el middleware de sesión cuando recibe x-api-token,
    // lo que rompe req.session.aid. Usamos solo la cookie de sesión.
    if (sid) {
      headers['Cookie'] = `mdstrm.id=${sid}`;
    }

    this.client = axios.create({
      baseURL,
      headers,
      timeout: 30000,
    });

    this.accountId = accountId;

    // Interceptor para logging y manejo de errores
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const errorData = error.response?.data as Record<string, unknown> | undefined;
        console.error('Mediastream API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          data: errorData,
        });

        // Mejorar mensajes de error
        if (errorData?.data === 'JWT_INVALID' || errorData?.data === 'INVALID_TOKEN') {
          const customError = new Error(
            'Token JWT inválido. Asegúrate de usar un JWT válido generado por Mediastream. ' +
            'Puedes obtenerlo desde la consola del navegador mientras estás logueado en la plataforma.'
          );
          (customError as any).code = 'JWT_INVALID';
          throw customError;
        }

        if (errorData?.data === 'EXPIRED_TOKEN') {
          const customError = new Error('El token JWT ha expirado. Genera uno nuevo.');
          (customError as any).code = 'TOKEN_EXPIRED';
          throw customError;
        }

        if (errorData?.data === 'ACCOUNT_NOT_FOUND') {
          const customError = new Error('Cuenta no encontrada. Verifica el MEDIASTREAM_ACCOUNT_ID.');
          (customError as any).code = 'ACCOUNT_NOT_FOUND';
          throw customError;
        }

        if (errorData?.data === 'EXPIRED_SESSION') {
          const customError = new Error(
            'Sesión expirada. Debes actualizar MEDIASTREAM_SESSION_COOKIE con una cookie connect.sid válida.'
          );
          (customError as any).code = 'EXPIRED_SESSION';
          throw customError;
        }

        // Error de sesión faltante (Cannot read property 'aid' of undefined)
        const errorMessage = error.message || '';
        if (errorMessage.includes('aid') || errorMessage.includes('session')) {
          const customError = new Error(
            'Cookie de sesión inválida o faltante. Asegúrate de configurar MEDIASTREAM_SESSION_COOKIE ' +
            'con el valor de la cookie connect.sid de tu sesión activa en Mediastream.'
          );
          (customError as any).code = 'SESSION_REQUIRED';
          throw customError;
        }

        throw error;
      }
    );
  }

  // ==================== Migrations ====================

  async listMigrations(): Promise<MediastreamMigrationConfig[]> {
    const response = await this.client.get('/api/settings/migration/index');
    return response.data;
  }

  async getMigration(migrationId: string): Promise<MediastreamMigrationConfig> {
    const response = await this.client.get(`/api/settings/migration/${migrationId}`);
    return response.data;
  }

  async createMigration(data: {
    name: string;
    strategy: 'transcode' | 'upload';
    mappings: MappingConfig[];
  }): Promise<MediastreamMigrationConfig> {
    const response = await this.client.post('/api/settings/migration/create', data);
    return response.data;
  }

  async updateMigration(
    migrationId: string,
    data: Partial<MediastreamMigrationConfig>
  ): Promise<MediastreamMigrationConfig> {
    const response = await this.client.put(`/api/settings/migration/${migrationId}`, data);
    return response.data;
  }

  async deleteMigration(migrationId: string): Promise<void> {
    await this.client.delete(`/api/settings/migration/${migrationId}`);
  }

  async validateMigration(migrationId: string): Promise<{ valid: boolean; errors?: string[] }> {
    const response = await this.client.put(`/api/settings/migration/${migrationId}/validate`);
    return response.data;
  }

  // ==================== Migration Control ====================

  async startMigration(migrationId: string): Promise<MediastreamMigrationConfig> {
    const response = await this.client.put(`/api/settings/migration/${migrationId}/start`);
    return response.data;
  }

  async stopMigration(migrationId: string): Promise<MediastreamMigrationConfig> {
    const response = await this.client.put(`/api/settings/migration/${migrationId}/stop`);
    return response.data;
  }

  async retryMigration(migrationId: string): Promise<MediastreamMigrationConfig> {
    const response = await this.client.put(`/api/settings/migration/${migrationId}/retry`);
    return response.data;
  }

  async deleteErroredItems(migrationId: string): Promise<void> {
    await this.client.delete(`/api/settings/migration/${migrationId}/deleteErrored`);
  }

  // ==================== File Upload ====================

  async getUploadUrl(migrationId: string): Promise<{
    url: string;
    fields: Record<string, string>;
  }> {
    const response = await this.client.post(`/api/settings/migration/${migrationId}/upload`);
    return response.data;
  }

  async processCSV(migrationId: string, fileName: string): Promise<MediastreamJob> {
    const response = await this.client.post(`/api/settings/migration/${migrationId}/process`, {
      name: fileName,
    });
    return response.data;
  }

  // ==================== Jobs ====================

  async approveJob(migrationId: string, jobId: string): Promise<MediastreamJob> {
    const response = await this.client.put(
      `/api/settings/migration/${migrationId}/job/${jobId}/update`
    );
    return response.data;
  }

  async deleteJob(migrationId: string, jobId: string): Promise<void> {
    await this.client.delete(`/api/settings/migration/${migrationId}/job/${jobId}`);
  }

  // ==================== Reports ====================

  async generateReport(migrationId: string): Promise<void> {
    await this.client.post(`/api/settings/migration/${migrationId}/report`);
  }

  async getReportDownloadUrl(migrationId: string): Promise<string> {
    const response = await this.client.get(
      `/api/settings/migration/${migrationId}/downloadReport`
    );
    return response.data.url || response.request.res.responseUrl;
  }

  // ==================== Stats ====================

  async getMigrationStats(migrationId: string): Promise<MediastreamStats> {
    const migration = await this.getMigration(migrationId);
    return migration.stats || {
      waiting: 0,
      queued: 0,
      running: 0,
      done: 0,
      error: 0,
    };
  }

  // ==================== Mapper Options ====================

  async getMapperOptions(): Promise<Record<string, unknown>> {
    // Este endpoint puede no existir, pero intentamos obtenerlo del detail de una migración
    // Normalmente viene en la respuesta de la UI de settings/migration
    try {
      const response = await this.client.get('/settings/migration', {
        headers: { Accept: 'application/json' },
      });
      return response.data.mapperOptions || {};
    } catch {
      // Retornar mappers estándar si falla
      return this.getDefaultMapperOptions();
    }
  }

  private getDefaultMapperOptions(): Record<string, unknown> {
    return {
      id: {
        name: 'id',
        displayName: 'ID Único',
        required: true,
        description: 'Identificador único del contenido',
      },
      title: {
        name: 'title',
        displayName: 'Título',
        required: true,
        description: 'Título del contenido',
      },
      original: {
        name: 'original',
        displayName: 'URL de Origen',
        required: false,
        strategy: 'transcode',
        description: 'URL del archivo de video/audio original para transcodificar',
      },
      rendition: {
        name: 'rendition',
        displayName: 'Rendiciones',
        required: false,
        strategy: 'upload',
        description: 'URLs de rendiciones pre-transcodificadas',
      },
      description: {
        name: 'description',
        displayName: 'Descripción',
        required: false,
      },
      category: {
        name: 'category',
        displayName: 'Categoría',
        required: false,
      },
      category_id: {
        name: 'category_id',
        displayName: 'ID de Categoría',
        required: false,
      },
      tag: {
        name: 'tag',
        displayName: 'Tags',
        required: false,
      },
      thumb: {
        name: 'thumb',
        displayName: 'Thumbnail',
        required: false,
      },
      published: {
        name: 'published',
        displayName: 'Publicado',
        required: false,
      },
      date_created: {
        name: 'date_created',
        displayName: 'Fecha de Creación',
        required: false,
      },
      date_recorded: {
        name: 'date_recorded',
        displayName: 'Fecha de Grabación',
        required: false,
      },
      geo: {
        name: 'geo',
        displayName: 'Restricciones Geográficas',
        required: false,
      },
      show: {
        name: 'show',
        displayName: 'Show/Serie',
        required: false,
      },
      showSeason: {
        name: 'showSeason',
        displayName: 'Temporada',
        required: false,
      },
      showSeasonEpisode: {
        name: 'showSeasonEpisode',
        displayName: 'Episodio',
        required: false,
      },
      custom: {
        name: 'custom',
        displayName: 'Atributo Personalizado',
        required: false,
      },
    };
  }

  // ==================== Account ====================

  async getAccountInfo(): Promise<Record<string, unknown>> {
    const response = await this.client.get('/api/account');
    // SM2 devuelve { status: 'OK', data: { account: {...}, name: string, ... } }
    return response.data?.data || response.data;
  }

  async getRenditionRules(): Promise<string[]> {
    const response = await this.client.get('/api/account');
    const account = response.data?.data?.account || response.data?.account || {};
    return Array.isArray(account.auto_encoding_profiles) ? account.auto_encoding_profiles : [];
  }

  async getCategories(search?: string): Promise<unknown[]> {
    const params: Record<string, string> = {};
    if (search) params.category_name = search;
    const response = await this.client.get('/api/category', { params });
    return response.data?.data || response.data || [];
  }

  // ==================== Factory desde sesión activa ====================

  /**
   * Crea una instancia usando la sesión activa almacenada en la BD.
   * Si no hay sesión activa, usa las variables de entorno como fallback.
   */
  static async fromActiveSession(): Promise<MediastreamService> {
    const session = await AuthService.getDecryptedSession();
    if (session) {
      return new MediastreamService({
        apiUrl: session.apiUrl,
        jwt: session.jwt,
        sid: session.sid,
        accountId: session.accountId,
      });
    }
    // Fallback a variables de entorno (comportamiento legacy)
    return new MediastreamService();
  }

  // ==================== Connection Test ====================

  async testConnection(): Promise<{ success: boolean; error?: string; details?: string }> {
    // Con sesiones dinámicas, verificar si el cliente tiene credenciales
    const hasToken = !!(config.mediastream.apiToken);
    const hasSession = await AuthService.getActiveSession();

    if (!hasToken && !hasSession) {
      return {
        success: false,
        error: 'No hay sesión activa ni credenciales configuradas.',
        details: 'Inicia sesión desde el asistente de migración.',
      };
    }

    try {
      await this.listMigrations();
      return { success: true };
    } catch (error: any) {
      // Manejar errores personalizados del interceptor
      if (error.code === 'SESSION_REQUIRED' || error.code === 'EXPIRED_SESSION') {
        return {
          success: false,
          error: error.message,
          details:
            'Actualiza MEDIASTREAM_SESSION_COOKIE con una cookie connect.sid válida. ' +
            'Las cookies de sesión expiran periódicamente.',
        };
      }

      if (error.code === 'JWT_INVALID' || error.code === 'TOKEN_EXPIRED') {
        return {
          success: false,
          error: error.message,
          details: 'Obtén un nuevo JWT desde la plataforma de Mediastream.',
        };
      }

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          return {
            success: false,
            error: 'Token de API inválido o expirado',
            details: 'Verifica que MEDIASTREAM_API_TOKEN sea un JWT válido.',
          };
        }
        if (error.response?.status === 403) {
          return {
            success: false,
            error: 'Sin permisos para acceder a migraciones',
            details: 'Tu cuenta debe tener el módulo de migración habilitado.',
          };
        }

        // Capturar el error específico de 'aid'
        const responseData = error.response?.data;
        if (
          typeof responseData === 'string' &&
          responseData.includes('aid')
        ) {
          return {
            success: false,
            error: 'Cookie de sesión inválida o expirada',
            details:
              'Actualiza MEDIASTREAM_SESSION_COOKIE con el valor actual de connect.sid.',
          };
        }

        return { success: false, error: error.message };
      }

      return { success: false, error: String(error.message || 'Error de conexión desconocido') };
    }
  }

  // ==================== WebSocket URL ====================

  getWebSocketUrl(): string {
    const wsUrl = config.mediastream.apiUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    return `${wsUrl}/account/${this.accountId}/migration`;
  }
}
