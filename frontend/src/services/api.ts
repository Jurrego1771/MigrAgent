import axios from 'axios';
import {
  Migration,
  Template,
  CSVValidationResult,
  CSVAnalysisResult,
  EnrichedStats,
  Alert,
  MigrationLog,
  MapperOption,
  Settings,
  MappingConfig,
  RetryPolicy,
  URLCheckResult,
  SessionInfo,
  AuthValidateResult,
  AccountInfo,
  RenditionsInfo,
  URLValidationSummary,
  SM2Migration,
  StatsHistory,
  TransformationRule,
  BatchConfig,
} from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// ==================== Migrations ====================

export const migrationApi = {
  list: async (): Promise<Migration[]> => {
    const { data } = await api.get('/migrations');
    return data;
  },

  getById: async (id: string): Promise<Migration> => {
    const { data } = await api.get(`/migrations/${id}`);
    return data;
  },

  create: async (params: {
    name: string;
    strategy: 'transcode' | 'upload';
    mappings: MappingConfig[];
    templateId?: string;
    retryPolicy?: RetryPolicy;
  }): Promise<Migration> => {
    const { data } = await api.post('/migrations', params);
    return data;
  },

  update: async (
    id: string,
    params: Partial<{
      name: string;
      mappings: MappingConfig[];
      retryPolicy: RetryPolicy;
    }>
  ): Promise<Migration> => {
    const { data } = await api.put(`/migrations/${id}`, params);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/migrations/${id}`);
  },

  validate: async (
    id: string,
    file: File,
    checkUrls: boolean = true
  ): Promise<CSVValidationResult> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('checkUrls', String(checkUrls));

    const { data } = await api.post(`/migrations/${id}/validate`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  getValidation: async (id: string): Promise<CSVValidationResult> => {
    const { data } = await api.get(`/migrations/${id}/validation`);
    return data;
  },

  createInMediastream: async (id: string): Promise<{ mediastreamId: string }> => {
    const { data } = await api.post(`/migrations/${id}/create-in-mediastream`);
    return data;
  },

  start: async (id: string): Promise<void> => {
    await api.post(`/migrations/${id}/start`);
  },

  stop: async (id: string): Promise<void> => {
    await api.post(`/migrations/${id}/stop`);
  },

  retry: async (id: string): Promise<void> => {
    await api.post(`/migrations/${id}/retry`);
  },

  resume: async (id: string): Promise<{ success: boolean; fromRow: number }> => {
    const { data } = await api.post(`/migrations/${id}/resume`);
    return data;
  },

  getStats: async (id: string): Promise<EnrichedStats> => {
    const { data } = await api.get(`/migrations/${id}/stats`);
    return data;
  },

  getLogs: async (
    id: string,
    params?: { level?: string[]; category?: string; limit?: number }
  ): Promise<MigrationLog[]> => {
    const { data } = await api.get(`/migrations/${id}/logs`, { params });
    return data;
  },

  getStatsHistory: async (id: string): Promise<StatsHistory[]> => {
    const { data } = await api.get(`/migrations/${id}/stats-history`);
    return data;
  },

  downloadReport: (id: string): string => `/api/migrations/${id}/report/csv`,
};

// ==================== Templates ====================

export const templateApi = {
  list: async (): Promise<Template[]> => {
    const { data } = await api.get('/templates');
    return data;
  },

  getById: async (id: string): Promise<Template> => {
    const { data } = await api.get(`/templates/${id}`);
    return data;
  },

  create: async (params: {
    name: string;
    description?: string;
    strategy: 'transcode' | 'upload';
    mappings: MappingConfig[];
    expectedHeaders?: string[];
  }): Promise<Template> => {
    const { data } = await api.post('/templates', params);
    return data;
  },

  update: async (
    id: string,
    params: Partial<{
      name: string;
      description: string;
      mappings: MappingConfig[];
    }>
  ): Promise<Template> => {
    const { data } = await api.put(`/templates/${id}`, params);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/templates/${id}`);
  },

  duplicate: async (id: string, name: string): Promise<Template> => {
    const { data } = await api.post(`/templates/${id}/duplicate`, { name });
    return data;
  },

  detect: async (headers: string[]): Promise<{ found: boolean; template?: Template }> => {
    const { data } = await api.post('/templates/detect', { headers });
    return data;
  },
};

// ==================== CSV ====================

export const csvApi = {
  analyze: async (file: File): Promise<CSVAnalysisResult> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await api.post('/csv/analyze', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  validate: async (
    file: File,
    mappings?: MappingConfig[],
    checkUrls: boolean = true
  ): Promise<CSVValidationResult> => {
    const formData = new FormData();
    formData.append('file', file);
    if (mappings) {
      formData.append('mappings', JSON.stringify(mappings));
    }
    formData.append('checkUrls', String(checkUrls));

    const { data } = await api.post('/csv/validate', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  checkUrls: async (
    urls: string[]
  ): Promise<{ summary: Record<string, number>; results: URLCheckResult[] }> => {
    const { data } = await api.post('/csv/check-urls', { urls });
    return data;
  },

  checkUrl: async (url: string): Promise<URLCheckResult> => {
    const { data } = await api.post('/csv/check-url', { url });
    return data;
  },

  getMapperOptions: async (): Promise<MapperOption[]> => {
    const { data } = await api.get('/csv/mapper-options');
    return data;
  },

  // Wizard: archivos temporales
  uploadTemp: async (file: File): Promise<import('../types').TempCSVInfo & { tempId: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post('/csv/temp', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  normalizeTemp: async (
    tempId: string,
    extraColumns: { name: string; defaultValue: string }[],
    transformationRules: TransformationRule[] = [],
    skipDuplicateIds: string[] = [],
    idColumn?: string
  ): Promise<{ normalizedTempId: string; rowCount: number; addedColumns: string[]; skippedCount: number }> => {
    const { data } = await api.post(`/csv/temp/${tempId}/normalize`, {
      extraColumns, transformationRules, skipDuplicateIds, idColumn,
    });
    return data;
  },

  cleanupTemp: async (tempId: string): Promise<void> => {
    await api.delete(`/csv/temp/${tempId}`);
  },

  downloadTemp: (tempId: string): string => `/api/csv/temp/${tempId}/download`,

  extractUrls: async (
    tempId: string,
    mappings: MappingConfig[]
  ): Promise<{ urls: string[]; count: number }> => {
    const { data } = await api.post(`/csv/temp/${tempId}/extract-urls`, { mappings });
    return data;
  },

  validateUrls: async (
    tempId: string,
    mappings: MappingConfig[],
    concurrency?: number,
    samplePercent?: number
  ): Promise<{ results: URLCheckResult[]; summary: URLValidationSummary }> => {
    const { data } = await api.post(`/csv/temp/${tempId}/validate-urls`, {
      mappings,
      concurrency,
      samplePercent,
    });
    return data;
  },

  compareWithReport: async (
    tempId: string,
    reportFile: File,
    idField: string
  ): Promise<{
    totalCurrent: number;
    totalReport: number;
    duplicateCount: number;
    duplicates: string[];
    hasMore: boolean;
    importedToHistory: number;
    doneInReport: number;
  }> => {
    const formData = new FormData();
    formData.append('reportFile', reportFile);
    formData.append('idField', idField);
    const { data } = await api.post(`/csv/temp/${tempId}/compare-report`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  checkHistory: async (
    tempId: string,
    idColumn: string
  ): Promise<{ totalCurrent: number; duplicateCount: number; duplicates: string[]; hasMore: boolean }> => {
    const { data } = await api.post(`/csv/temp/${tempId}/check-history`, { idColumn });
    return data;
  },
};

// ==================== Alerts ====================

export const alertApi = {
  list: async (params?: {
    migrationId?: string;
    acknowledged?: boolean;
    limit?: number;
  }): Promise<Alert[]> => {
    const { data } = await api.get('/alerts', { params });
    return data;
  },

  acknowledge: async (id: string): Promise<void> => {
    await api.put(`/alerts/${id}/acknowledge`);
  },

  acknowledgeAll: async (migrationId?: string): Promise<void> => {
    await api.put('/alerts/acknowledge-all', { migrationId });
  },

  getUnreadCount: async (): Promise<{ count: number }> => {
    const { data } = await api.get('/alerts/unread-count');
    return data;
  },
};

// ==================== Settings ====================

export const settingsApi = {
  get: async (): Promise<Settings> => {
    const { data } = await api.get('/settings');
    return data;
  },

  update: async (params: Partial<Settings>): Promise<Settings> => {
    const { data } = await api.put('/settings', params);
    return data;
  },

  testConnection: async (): Promise<{ success: boolean; error?: string }> => {
    const { data } = await api.post('/settings/test-connection');
    return data;
  },

  getMediastreamMigrations: async (): Promise<SM2Migration[]> => {
    const { data } = await api.get('/settings/mediastream-migrations');
    return data;
  },
};

// ==================== Auth ====================

// ==================== Account ====================

export const accountApi = {
  getInfo: async (): Promise<AccountInfo> => {
    const { data } = await api.get('/account/info');
    return data;
  },

  getRenditions: async (): Promise<RenditionsInfo> => {
    const { data } = await api.get('/account/renditions');
    return data;
  },

  getCategories: async (search?: string): Promise<{ categories: unknown[] }> => {
    const { data } = await api.get('/account/categories', { params: search ? { search } : {} });
    return data;
  },
};

// ==================== Wizard ====================

export const wizardApi = {
  createMigration: async (params: {
    name: string;
    strategy: 'transcode' | 'upload';
    mappings: MappingConfig[];
    normalizedTempId: string;
    templateId?: string;
    transformationRules?: TransformationRule[];
    batchConfig?: BatchConfig;
    saveAsTemplate?: { name: string; expectedHeaders: string[] };
  }): Promise<{
    migrationId: string;
    mediastreamId: string;
    isBatch?: boolean;
    batchGroupId?: string;
    totalBatches?: number;
    batches?: Array<{ migrationId: string; mediastreamId: string; index: number; rowCount: number }>;
  }> => {
    const { data } = await api.post('/wizard/create', params);
    return data;
  },
};

// ==================== Dashboard ====================

export const dashboardApi = {
  getMetrics: async (): Promise<{
    totalMigrations: number;
    byStatus: Record<string, number>;
    totalItemsMigrated: number;
    totalItemsWithErrors: number;
    successRate: number | null;
    activity: Array<{ date: string; created: number; completed: number }>;
    recentMigrations: Array<{
      id: string;
      name: string;
      status: string;
      processedItems: number;
      totalItems: number;
      errorItems: number;
      createdAt: string;
      strategy: string;
    }>;
    topTemplates: Array<{ id: string; name: string; usageCount: number; strategy: string }>;
  }> => {
    const { data } = await api.get('/dashboard/metrics');
    return data;
  },
};

// ==================== Auth ====================

export const authApi = {
  login: async (params: {
    email: string;
    password: string;
    apiUrl?: string;
    totp?: string;
  }): Promise<{ success: boolean; session: SessionInfo }> => {
    const { data } = await api.post('/auth/login', params);
    return data;
  },

  importCredentials: async (params: {
    jwt: string;
    sid: string;
    apiUrl: string;
  }): Promise<{ success: boolean; session: SessionInfo }> => {
    const { data } = await api.post('/auth/import', params);
    return data;
  },

  getSession: async (): Promise<{ authenticated: boolean; session: SessionInfo | null }> => {
    const { data } = await api.get('/auth/session');
    return data;
  },

  listSessions: async (): Promise<{ sessions: SessionInfo[] }> => {
    const { data } = await api.get('/auth/sessions');
    return data;
  },

  validate: async (): Promise<AuthValidateResult> => {
    const { data } = await api.post('/auth/validate');
    return data;
  },

  logout: async (): Promise<void> => {
    await api.delete('/auth/session');
  },

  revokeSession: async (id: string): Promise<void> => {
    await api.delete(`/auth/sessions/${id}`);
  },
};

export default api;
