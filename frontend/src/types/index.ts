// Types shared with backend

// ==================== Auth ====================

export interface SessionInfo {
  id: string;
  accountId: string;
  accountName: string | null;
  userEmail: string;
  apiUrl: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthValidateResult {
  valid: boolean;
  session: SessionInfo | null;
  reason?: string;
}

// ==================== Account ====================

export interface AccountModuleChecks {
  media: boolean;
  migration: boolean;
  vod: boolean;
  aod: boolean;
  advertising: boolean;
  drm: boolean;
}

export interface AIFeatureStatus {
  enabled: boolean;
  automatic: boolean;
  model?: string;
}

export interface AccountInfo {
  account: {
    id: string | null;
    name: string | null;
    encodingProfiles: string[];
    advertisingEnabled: boolean;
    advertisingConfig: Record<string, unknown> | null;
    normalizeAudio: boolean;
  };
  modules: Record<string, boolean>;
  moduleChecks: AccountModuleChecks;
  aiSettings?: Record<string, AIFeatureStatus>;
}

export interface RenditionRule {
  id: string;
  name: string;
  code: string;
  profileRange?: { min: string; max: string };
  profiles: string[];
}

export interface RenditionsInfo {
  rules: RenditionRule[];
  activeProfiles: string[];
  activeVideoProfiles: string[];
  missingVideoProfiles: string[];
  allVideoProfiles: string[];
}

// ==================== CSV Wizard ====================

export interface TempCSVInfo {
  tempId: string;
  fileName: string;
  headers: string[];
  rowCount: number;
  detectedMappings: DetectedMapping[];
  emptyFields: Record<string, number>;
  preview: CSVPreviewRow[];
  warnings: CSVValidationWarning[];
}

export interface ExtraColumn {
  name: string;
  defaultValue: string;
  reason: string; // por qué se sugiere
}

export interface CSVWizardState {
  tempFile: TempCSVInfo | null;
  mappings: MappingConfig[];            // editados por el usuario
  extraColumns: ExtraColumn[];          // columnas adicionales a agregar
  normalizedTempId: string | null;      // ID del CSV normalizado (listo para SM2)
  transformationRules: TransformationRule[]; // reglas de transformación de datos
  templateId: string | null;            // template aplicado (para incrementar usageCount)
  // Deduplicación por historial
  historyDuplicates: { count: number; ids: string[] } | null;
  skipHistoryDuplicates: boolean;
}

// ==================== URL Validation Wizard (Step 4) ====================

export interface DomainSummary {
  total: number;
  accessible: number;
  rateLimited: number;
}

export interface URLValidationSummary {
  total: number;
  accessible: number;
  failed: number;
  withRateLimit: number;
  byDomain: Record<string, DomainSummary>;
  sampledFrom: number;
  samplePercent: number;
}

export interface URLValidationWizardState {
  status: 'idle' | 'checking' | 'done';
  summary: URLValidationSummary | null;
  results: URLCheckResult[];
  checkedAt: string | null;
}

// Estado del paso 2 del wizard
export interface AccountValidationState {
  accountInfo: AccountInfo | null;
  renditionsInfo: RenditionsInfo | null;
  // Respuestas del usuario
  contentType: 'vod' | 'aod' | 'both' | null;
  hasAdvertising: boolean | null;
  suggestCategoryField: boolean;
  // Nombre y estrategia de la migración
  migrationName: string;
  migrationStrategy: 'transcode' | 'upload';
}

export interface MappingConfig {
  mapper: string;
  field: string;
  options?: Record<string, unknown>;
}

export interface Template {
  id: string;
  name: string;
  description?: string;
  strategy: 'transcode' | 'upload';
  mappings: MappingConfig[];
  expectedHeaders: string[];
  usageCount: number;
}

export interface SM2Migration {
  _id: string;
  name: string;
  status: string;
  stats?: {
    waiting: number;
    queued: number;
    running: number;
    done: number;
    error: number;
  };
}

export interface Migration {
  id: string;
  name: string;
  mediastreamConfigId?: string;
  templateId?: string;
  template?: Template;
  status: MigrationStatus;
  strategy: 'transcode' | 'upload';
  mappings: string; // JSON stringified
  csvFileName?: string;
  totalItems: number;
  processedItems: number;
  successItems: number;
  errorItems: number;
  startedAt?: string;
  completedAt?: string;
  lastUpdateAt?: string;
  retryEnabled: boolean;
  maxRetries: number;
  currentRetryCount: number;
  retryBackoffType: 'fixed' | 'linear' | 'exponential';
  retryInitialDelay: number;
  retryMaxDelay: number;
  // Checkpoint para reanudación
  checkpointData?: string; // JSON stringified { lastSuccessfulRow, sm2MigrationId, timestamp }
  createdAt: string;
  updatedAt: string;
  validationResults?: ValidationResult[];
}

export type MigrationStatus =
  | 'created'
  | 'validating'
  | 'validated'
  | 'running'
  | 'paused'
  | 'done'
  | 'error';

export interface ValidationResult {
  id: string;
  migrationId: string;
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: string; // JSON
  warnings: string; // JSON
  urlsChecked: number;
  urlsAccessible: number;
  urlsWithRateLimit: number;
  urlDetails?: string; // JSON
  duplicates?: string; // JSON
  emptyFields?: string; // JSON
  createdAt: string;
}

export interface CSVValidationError {
  row: number;
  field: string;
  error: string;
  value?: string;
}

export interface CSVValidationWarning {
  row: number;
  field: string;
  warning: string;
  value?: string;
}

export interface URLCheckResult {
  url: string;
  accessible: boolean;
  statusCode?: number;
  contentType?: string;
  contentLength?: number;
  duration?: number;
  resolution?: string;
  hasRateLimit: boolean;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    resetTime?: number;
  };
  error?: string;
  responseTime?: number;
  formattedSize?: string;
  formattedDuration?: string;
}

export interface DuplicateInfo {
  id: string;
  rows: number[];
}

export interface DetectedMapping {
  field: string;
  suggestedMapper: string;
  confidence: number;
  sampleValues: string[];
}

export interface CSVValidationResult {
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errors: CSVValidationError[];
  warnings: CSVValidationWarning[];
  urlDetails: URLCheckResult[];
  duplicates: DuplicateInfo[];
  emptyFields: Record<string, number>;
  detectedMappings?: DetectedMapping[];
  preview: CSVPreviewRow[];
}

export interface CSVPreviewRow {
  row: number;
  input: Record<string, string>;
  output: Record<string, unknown>;
}

export interface CSVAnalysisResult {
  headers: string[];
  rowCount: number;
  detectedMappings: DetectedMapping[];
  emptyFields: Record<string, number>;
  preview: CSVPreviewRow[];
  warnings: CSVValidationWarning[];
}

export interface EnrichedStats {
  waiting: number;
  queued: number;
  running: number;
  done: number;
  error: number;
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  speed: number;
  eta: number | null;
  etaFormatted: string;
  successRate: number;
}

export interface Alert {
  id: string;
  migrationId?: string;
  migration?: Migration;
  type: 'stalled' | 'error_threshold' | 'retry_exhausted' | 'completed';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: string;
  acknowledged: boolean;
  createdAt: string;
}

export interface MigrationLog {
  id: string;
  migrationId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: string;
  message: string;
  data?: string;
  createdAt: string;
}

export interface MapperOption {
  name: string;
  displayName: string;
  description?: string;
  required: boolean;
  strategy?: 'transcode' | 'upload';
  options: MapperOptionField[];
}

export interface MapperOptionField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'field';
  description?: string;
  options?: string[];
}

export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
  initialDelay: number;
  maxDelay: number;
}

export interface Settings {
  id: string;
  mediastreamApiUrl: string;
  mediastreamAccountId?: string;
  alertOnStalled: boolean;
  stalledThresholdMs: number;
  alertOnErrorThreshold: boolean;
  errorThresholdPercent: number;
  urlCheckTimeout: number;
  urlCheckConcurrency: number;
  // Notificaciones
  notificationEmail?: string;
  notificationWebhookUrl?: string;
  notifyOnComplete: boolean;
  notifyOnError: boolean;
}

// ==================== Batch Config ====================

export interface BatchConfig {
  enabled: boolean;
  size: number;
  namePrefix: string;
  mode: 'auto' | 'manual';
}

// ==================== Transformation Rules ====================

export type TransformationRuleType =
  | 'replace'
  | 'prefix'
  | 'suffix'
  | 'uppercase'
  | 'lowercase'
  | 'trim'
  | 'regex'
  | 'map_value'
  | 'default'
  | 'truncate';

export interface TransformationRule {
  id: string;
  field: string;
  type: TransformationRuleType;
  find?: string;
  replace?: string;
  value?: string;
  mappingTable?: Record<string, string>;
  enabled: boolean;
}

export interface StatsHistory {
  id: string;
  migrationId: string;
  waiting: number;
  queued: number;
  running: number;
  done: number;
  error: number;
  speed: number;
  timestamp: string;
}
