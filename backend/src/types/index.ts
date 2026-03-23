// Tipos para mappers de Mediastream
export interface MappingConfig {
  mapper: string;
  field: string;
  options?: Record<string, unknown>;
}

export interface TemplateData {
  name: string;
  description?: string;
  strategy: 'transcode' | 'upload';
  mappings: MappingConfig[];
  expectedHeaders: string[];
}

// Tipos para validación de CSV
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
  contentLength?: number; // bytes
  duration?: number; // segundos (para video/audio)
  resolution?: string; // ej: "1920x1080"
  hasRateLimit: boolean;
  rateLimitInfo?: {
    limit?: number;
    remaining?: number;
    resetTime?: number;
  };
  error?: string;
  responseTime?: number; // ms
}

export interface DuplicateInfo {
  id: string;
  rows: number[];
}

export interface EmptyFieldsInfo {
  [fieldName: string]: number;
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
  emptyFields: EmptyFieldsInfo;
  detectedMappings?: DetectedMapping[];
  preview: CSVPreviewRow[];
}

export interface DetectedMapping {
  field: string;
  suggestedMapper: string;
  confidence: number; // 0-1
  sampleValues: string[];
}

export interface CSVPreviewRow {
  row: number;
  input: Record<string, string>;
  output: Record<string, unknown>;
}

// Tipos para Mediastream API
export interface MediastreamMigrationConfig {
  _id?: string;
  name: string;
  strategy: 'transcode' | 'upload';
  keys: string[];
  mappings: MappingConfig[];
  stats?: MediastreamStats;
  status?: 'new' | 'paused' | 'running' | 'done';
}

export interface MediastreamStats {
  waiting: number;
  queued: number;
  running: number;
  done: number;
  error: number;
  updateTime?: string;
}

export interface MediastreamJob {
  _id: string;
  config: string;
  source: {
    type: string;
    fileName: string;
  };
  status: string;
  stats: {
    total: number;
  };
}

// Tipos para monitoreo
export interface EnrichedStats extends MediastreamStats {
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
  speed: number; // items/min
  eta: number | null; // ms
  etaFormatted: string;
  successRate: number;
}

// Tipos para retry
export interface RetryPolicy {
  enabled: boolean;
  maxRetries: number;
  backoffType: 'fixed' | 'linear' | 'exponential';
  initialDelay: number; // ms
  maxDelay: number; // ms
}

// Tipos para alertas
export interface AlertData {
  type: 'stalled' | 'error_threshold' | 'retry_exhausted' | 'completed';
  severity: 'info' | 'warning' | 'critical';
  migrationId?: string;
  migrationName?: string;
  message: string;
  data?: Record<string, unknown>;
}

// Tipos para auto-detección de campos
// Patrones de detección automática — solo mappers soportados por SM2
export const MAPPER_PATTERNS: Record<string, RegExp[]> = {
  id:           [/^id$/i, /^video[_-]?id$/i, /^media[_-]?id$/i, /^content[_-]?id$/i, /^asset[_-]?id$/i, /^uid$/i, /^uuid$/i],
  title:        [/^title$/i, /^titulo$/i, /^name$/i, /^nombre$/i, /^video[_-]?title$/i],
  original:     [/^url$/i, /^video[_-]?url$/i, /^source[_-]?url$/i, /^original$/i, /^link$/i, /^src$/i],
  rendition:    [/^rendition$/i, /^mp4$/i, /^hls$/i, /^dash$/i],
  description:  [/^description$/i, /^desc$/i, /^descripcion$/i, /^summary$/i, /^sinopsis$/i],
  category:     [/^category$/i, /^categoria$/i, /^folder$/i, /^carpeta$/i],
  tag:          [/^tags?$/i, /^etiquetas?$/i, /^keywords?$/i, /^labels?$/i],
  thumb:        [/^thumb(nail)?$/i, /^poster$/i, /^image$/i, /^imagen$/i, /^cover$/i],
  published:    [/^publish(ed)?$/i, /^public(o)?$/i, /^visible$/i, /^active$/i],
  date_created: [/^date[_-]?created$/i, /^created[_-]?(at|date)?$/i, /^fecha[_-]?creacion$/i],
  date_recorded:[/^date[_-]?recorded$/i, /^recorded[_-]?(at|date)?$/i, /^fecha[_-]?grabacion$/i],
  show:         [/^show$/i, /^serie$/i, /^program(a)?$/i],
};

// Tipos para migración por lotes
export interface BatchConfig {
  enabled: boolean;
  size: number;           // items por lote
  namePrefix: string;     // prefijo para nombres en SM2
  mode: 'auto' | 'manual'; // auto = crear todos, manual = uno a uno con confirmación
}

// Tipos para reglas de transformación
export type TransformationRuleType =
  | 'replace'       // reemplazar texto
  | 'prefix'        // agregar prefijo
  | 'suffix'        // agregar sufijo
  | 'uppercase'     // convertir a mayúsculas
  | 'lowercase'     // convertir a minúsculas
  | 'trim'          // recortar espacios
  | 'regex'         // reemplazar con regex
  | 'map_value'     // mapear valor A → B
  | 'default'       // valor por defecto si está vacío
  | 'truncate';     // truncar a N caracteres

export interface TransformationRule {
  id: string;
  field: string;               // campo CSV al que aplica
  type: TransformationRuleType;
  // Parámetros según tipo
  find?: string;               // replace, regex
  replace?: string;            // replace, regex
  value?: string;              // prefix, suffix, default, truncate (as string)
  mappingTable?: Record<string, string>; // map_value
  enabled: boolean;
}

// Tipos para WebSocket events
export interface WSEvent {
  type: string;
  data: unknown;
}

export interface MigrationStatusEvent extends WSEvent {
  type: 'MIGRATION_STATUS';
  data: {
    migrationId: string;
    stats: EnrichedStats;
  };
}

export interface ValidationProgressEvent extends WSEvent {
  type: 'VALIDATION_PROGRESS';
  data: {
    migrationId: string;
    progress: number;
    currentStep: string;
  };
}
