import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import path from 'path';
import {
  CSVValidationResult,
  CSVValidationError,
  CSVValidationWarning,
  DuplicateInfo,
  EmptyFieldsInfo,
  DetectedMapping,
  CSVPreviewRow,
  MappingConfig,
  MAPPER_PATTERNS,
  TransformationRule,
} from '../types/index.js';
import { TransformationEngine } from './transformation-engine.service.js';
import { URLValidatorService } from './url-validator.service.js';
import { config } from '../config/index.js';

export class CSVValidatorService {
  private urlValidator: URLValidatorService;
  private transformEngine: TransformationEngine;

  constructor() {
    this.urlValidator = new URLValidatorService();
    this.transformEngine = new TransformationEngine();
  }

  async validateCSV(
    filePath: string,
    mappings?: MappingConfig[],
    options?: {
      checkUrls?: boolean;
      sampleSize?: number;
    }
  ): Promise<CSVValidationResult> {
    const checkUrls = options?.checkUrls ?? true;
    const sampleSize = options?.sampleSize ?? config.validation.maxSampleSize;

    const result: CSVValidationResult = {
      isValid: true,
      totalRows: 0,
      validRows: 0,
      errorRows: 0,
      warningRows: 0,
      errors: [],
      warnings: [],
      urlDetails: [],
      duplicates: [],
      emptyFields: {},
      detectedMappings: [],
      preview: [],
    };

    const rows: Record<string, string>[] = [];
    let headers: string[] = [];

    // Parsear CSV
    await new Promise<void>((resolve, reject) => {
      const parser = createReadStream(filePath).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        })
      );

      parser.on('data', (row: Record<string, string>) => {
        rows.push(row);
      });

      parser.on('error', reject);
      parser.on('end', resolve);
    });

    if (rows.length === 0) {
      result.isValid = false;
      result.errors.push({
        row: 0,
        field: '_file',
        error: 'El archivo CSV está vacío o no tiene datos válidos',
      });
      return result;
    }

    headers = Object.keys(rows[0]);
    result.totalRows = rows.length;

    // Auto-detectar mappings si no se proporcionan
    result.detectedMappings = this.detectMappings(headers, rows.slice(0, 10));

    // Validar cada fila
    const idField = this.findIdField(mappings, result.detectedMappings);
    const urlField = this.findUrlField(mappings, result.detectedMappings);
    const seenIds = new Map<string, number[]>();
    const rowErrors = new Set<number>();
    const rowWarnings = new Set<number>();
    const urlsToCheck: { url: string; row: number }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 por header y 0-index

      // Validar ID único
      if (idField) {
        const id = row[idField]?.trim();
        if (!id) {
          result.errors.push({
            row: rowNum,
            field: idField,
            error: 'ID vacío o ausente',
          });
          rowErrors.add(rowNum);
        } else {
          const existing = seenIds.get(id);
          if (existing) {
            existing.push(rowNum);
          } else {
            seenIds.set(id, [rowNum]);
          }
        }
      }

      // Validar campos vacíos
      for (const [field, value] of Object.entries(row)) {
        const trimmed = value?.trim();
        if (!trimmed || trimmed === '') {
          result.emptyFields[field] = (result.emptyFields[field] || 0) + 1;
        }

        // Detectar problemas comunes
        this.detectCommonIssues(field, value, rowNum, result);
      }

      // Recolectar URLs para verificar
      if (urlField && checkUrls) {
        const url = row[urlField]?.trim();
        if (url) {
          urlsToCheck.push({ url, row: rowNum });
        }
      }

      // Generar preview
      if (i < sampleSize) {
        result.preview.push({
          row: rowNum,
          input: row,
          output: mappings ? this.simulateMapping(row, mappings) : row,
        });
      }
    }

    // Procesar duplicados
    for (const [id, rowList] of seenIds) {
      if (rowList.length > 1) {
        result.duplicates.push({ id, rows: rowList });
        for (const r of rowList.slice(1)) {
          result.errors.push({
            row: r,
            field: idField || 'id',
            error: `ID duplicado "${id}" (primera aparición en fila ${rowList[0]})`,
            value: id,
          });
          rowErrors.add(r);
        }
      }
    }

    // Verificar URLs (en paralelo con límite)
    if (checkUrls && urlsToCheck.length > 0) {
      const urlResults = await this.urlValidator.checkUrls(
        urlsToCheck.map((u) => u.url),
        config.validation.urlCheckConcurrency
      );

      for (let i = 0; i < urlResults.length; i++) {
        const urlResult = urlResults[i];
        const rowNum = urlsToCheck[i].row;

        result.urlDetails.push(urlResult);

        if (!urlResult.accessible) {
          result.errors.push({
            row: rowNum,
            field: urlField || 'url',
            error: urlResult.error || 'URL no accesible',
            value: urlResult.url,
          });
          rowErrors.add(rowNum);
        }

        if (urlResult.hasRateLimit) {
          result.warnings.push({
            row: rowNum,
            field: urlField || 'url',
            warning: `El servidor tiene rate limiting: ${JSON.stringify(urlResult.rateLimitInfo)}`,
            value: urlResult.url,
          });
          rowWarnings.add(rowNum);
        }
      }
    }

    // Generar advertencias para campos vacíos significativos
    for (const [field, count] of Object.entries(result.emptyFields)) {
      const percentage = (count / result.totalRows) * 100;
      if (percentage > 5) {
        result.warnings.push({
          row: 0,
          field,
          warning: `${count} filas (${percentage.toFixed(1)}%) tienen el campo "${field}" vacío`,
        });
      }
    }

    // Calcular totales
    result.errorRows = rowErrors.size;
    result.warningRows = rowWarnings.size;
    result.validRows = result.totalRows - result.errorRows;
    result.isValid = result.errorRows === 0;

    return result;
  }

  private detectMappings(headers: string[], sampleRows: Record<string, string>[]): DetectedMapping[] {
    const detectedMappings: DetectedMapping[] = [];

    for (const header of headers) {
      const mapping = this.detectMapperForField(header, sampleRows);
      if (mapping) {
        detectedMappings.push({
          field: header,
          suggestedMapper: mapping.mapper,
          confidence: mapping.confidence,
          sampleValues: sampleRows.slice(0, 3).map((r) => r[header] || ''),
        });
      }
    }

    return detectedMappings;
  }

  private detectMapperForField(
    field: string,
    sampleRows: Record<string, string>[]
  ): { mapper: string; confidence: number } | null {
    // Primero intentar por nombre del campo
    for (const [mapper, patterns] of Object.entries(MAPPER_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(field)) {
          return { mapper, confidence: 0.9 };
        }
      }
    }

    // Intentar por contenido de las muestras
    const samples = sampleRows.map((r) => r[field] || '').filter((v) => v.trim() !== '');

    if (samples.length === 0) return null;

    // Detectar URLs
    const urlPattern = /^https?:\/\/.+/i;
    if (samples.every((s) => urlPattern.test(s))) {
      // Determinar si es original (video), thumb (imagen), o rendition
      const videoExtensions = /\.(mp4|mov|avi|mkv|webm|m3u8|mpd)(\?|$)/i;
      const imageExtensions = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i;

      if (samples.some((s) => videoExtensions.test(s))) {
        return { mapper: 'original', confidence: 0.8 };
      }
      if (samples.some((s) => imageExtensions.test(s))) {
        return { mapper: 'thumb', confidence: 0.8 };
      }
      return { mapper: 'original', confidence: 0.6 };
    }

    // Detectar fechas
    const datePattern = /^\d{4}[-/]\d{2}[-/]\d{2}/;
    if (samples.every((s) => datePattern.test(s))) {
      return { mapper: 'date_created', confidence: 0.7 };
    }

    // Detectar booleanos
    const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'si', 'no'];
    if (samples.every((s) => booleanValues.includes(s.toLowerCase()))) {
      return { mapper: 'published', confidence: 0.7 };
    }

    // Detectar números (posibles episodios/temporadas)
    if (samples.every((s) => /^\d+$/.test(s))) {
      if (field.toLowerCase().includes('season') || field.toLowerCase().includes('temporada')) {
        return { mapper: 'showSeason', confidence: 0.8 };
      }
      if (field.toLowerCase().includes('episode') || field.toLowerCase().includes('episodio')) {
        return { mapper: 'showSeasonEpisode', confidence: 0.8 };
      }
    }

    // Detectar tags (valores separados por comas)
    if (samples.some((s) => s.includes(',') && s.split(',').length > 1)) {
      return { mapper: 'tag', confidence: 0.6 };
    }

    return null;
  }

  private findIdField(
    mappings?: MappingConfig[],
    detected?: DetectedMapping[]
  ): string | undefined {
    if (mappings) {
      const idMapping = mappings.find((m) => m.mapper === 'id');
      if (idMapping) return idMapping.field;
    }
    if (detected) {
      const idDetected = detected.find((d) => d.suggestedMapper === 'id');
      if (idDetected) return idDetected.field;
    }
    return undefined;
  }

  private findUrlField(
    mappings?: MappingConfig[],
    detected?: DetectedMapping[]
  ): string | undefined {
    if (mappings) {
      const urlMapping = mappings.find((m) => m.mapper === 'original' || m.mapper === 'rendition');
      if (urlMapping) return urlMapping.field;
    }
    if (detected) {
      const urlDetected = detected.find(
        (d) => d.suggestedMapper === 'original' || d.suggestedMapper === 'rendition'
      );
      if (urlDetected) return urlDetected.field;
    }
    return undefined;
  }

  private detectCommonIssues(
    field: string,
    value: string,
    rowNum: number,
    result: CSVValidationResult
  ): void {
    if (!value) return;

    // Espacios al inicio o final
    if (value !== value.trim()) {
      result.warnings.push({
        row: rowNum,
        field,
        warning: 'Contiene espacios al inicio o final',
        value: `"${value.substring(0, 20)}..."`,
      });
    }

    // Caracteres especiales problemáticos
    const problematicChars = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    if (problematicChars.test(value)) {
      result.warnings.push({
        row: rowNum,
        field,
        warning: 'Contiene caracteres de control no imprimibles',
      });
    }

    // URLs malformadas
    if (value.startsWith('http') && !this.isValidUrl(value)) {
      result.errors.push({
        row: rowNum,
        field,
        error: 'URL malformada',
        value: value.substring(0, 50),
      });
    }

    // Fechas en formato incorrecto
    if (field.toLowerCase().includes('date') || field.toLowerCase().includes('fecha')) {
      if (value && !this.isValidDate(value)) {
        result.warnings.push({
          row: rowNum,
          field,
          warning: 'Formato de fecha posiblemente incorrecto (se espera YYYY-MM-DD)',
          value,
        });
      }
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private isValidDate(dateStr: string): boolean {
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  }

  private simulateMapping(
    row: Record<string, string>,
    mappings: MappingConfig[]
  ): Record<string, unknown> {
    const output: Record<string, unknown> = {};

    for (const mapping of mappings) {
      const value = row[mapping.field];
      if (value !== undefined) {
        output[mapping.mapper] = value;
      }
    }

    return output;
  }

  getHeaders(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const parser = createReadStream(filePath).pipe(
        parse({
          columns: false,
          to_line: 1,
        })
      );

      parser.on('data', (row: string[]) => {
        resolve(row);
      });

      parser.on('error', reject);
    });
  }

  /**
   * Genera un CSV normalizado a partir del original:
   * - Recorta espacios en todos los valores
   * - Agrega columnas extra con valores por defecto
   * - Escribe el resultado en outputPath
   */
  async normalizeCSV(
    inputPath: string,
    outputPath: string,
    extraColumns: { name: string; defaultValue: string }[] = [],
    transformationRules: TransformationRule[] = [],
    skipIds: Set<string> = new Set(),
    idColumn?: string
  ): Promise<{ rowCount: number; addedColumns: string[]; skippedCount: number }> {
    const rows: Record<string, string>[] = [];

    await new Promise<void>((resolve, reject) => {
      const parser = createReadStream(inputPath).pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
      );
      parser.on('data', (row: Record<string, string>) => rows.push(row));
      parser.on('error', reject);
      parser.on('end', resolve);
    });

    if (rows.length === 0) return { rowCount: 0, addedColumns: [], skippedCount: 0 };

    const addedColumns = extraColumns.map((c) => c.name);
    const headers = [...Object.keys(rows[0]), ...addedColumns];

    let skippedCount = 0;
    const normalizedRows = rows.flatMap((row) => {
      // Filtrar IDs ya migrados si se solicitó
      if (skipIds.size > 0 && idColumn) {
        const rowId = row[idColumn]?.trim();
        if (rowId && skipIds.has(rowId)) {
          skippedCount++;
          return [];
        }
      }

      // 1. trim básico
      const normalized: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        normalized[k] = typeof v === 'string' ? v.trim() : v;
      }
      // 2. columnas extra
      for (const extra of extraColumns) {
        normalized[extra.name] = extra.defaultValue;
      }
      // 3. reglas de transformación
      return [
        transformationRules.length > 0
          ? this.transformEngine.applyRules(normalized, transformationRules)
          : normalized,
      ];
    });

    await pipeline(
      (async function* () {
        yield headers;
        for (const row of normalizedRows) {
          yield headers.map((h) => row[h] ?? '');
        }
      })(),
      stringify(),
      createWriteStream(outputPath)
    );

    return { rowCount: normalizedRows.length, addedColumns, skippedCount };
  }

  /**
   * Parsea un CSV de reporte SM2 y extrae los IDs de items con migrationStatus === 'done'.
   * Columna de ID: 'ID of video in your CMS'
   */
  async parseReportIds(filePath: string): Promise<{ ids: string[]; totalRows: number; doneCount: number }> {
    const ID_COL = 'ID of video in your CMS';
    const STATUS_COL = 'migrationStatus';
    const ids: string[] = [];
    let totalRows = 0;

    await new Promise<void>((resolve, reject) => {
      createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: Record<string, string>) => {
          totalRows++;
          if (row[STATUS_COL]?.trim().toLowerCase() === 'done') {
            const id = row[ID_COL]?.trim();
            if (id) ids.push(id);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    return { ids, totalRows, doneCount: ids.length };
  }

  async getRowCount(filePath: string): Promise<number> {
    let count = 0;
    return new Promise((resolve, reject) => {
      const parser = createReadStream(filePath).pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
        })
      );

      parser.on('data', () => {
        count++;
      });

      parser.on('error', reject);
      parser.on('end', () => resolve(count));
    });
  }

  /**
   * Extrae todos los valores del campo mapeado como 'id' de un CSV.
   * Usado para comparar contra reportes de migraciones anteriores.
   */
  async extractIds(filePath: string, idField: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const ids: string[] = [];
      createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: Record<string, string>) => {
          const val = row[idField]?.trim();
          if (val) ids.push(val);
        })
        .on('end', () => resolve(ids))
        .on('error', reject);
    });
  }

  /**
   * Divide un CSV en sub-archivos de `batchSize` filas cada uno.
   * Devuelve los paths de los archivos generados en orden.
   */
  async splitCSV(
    inputPath: string,
    outputDir: string,
    batchSize: number
  ): Promise<{ paths: string[]; rowCounts: number[] }> {
    const rows: Record<string, string>[] = [];
    let headers: string[] = [];

    await new Promise<void>((resolve, reject) => {
      const parser = createReadStream(inputPath).pipe(
        parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
      );
      parser.on('data', (row: Record<string, string>) => {
        if (headers.length === 0) headers = Object.keys(row);
        rows.push(row);
      });
      parser.on('error', reject);
      parser.on('end', resolve);
    });

    const paths: string[] = [];
    const rowCounts: number[] = [];
    const totalBatches = Math.ceil(rows.length / batchSize);

    for (let i = 0; i < totalBatches; i++) {
      const batchRows = rows.slice(i * batchSize, (i + 1) * batchSize);
      const outPath = path.join(outputDir, `batch-${i + 1}-of-${totalBatches}-${Date.now()}.csv`);

      await pipeline(
        (async function* () {
          yield headers;
          for (const row of batchRows) {
            yield headers.map((h) => row[h] ?? '');
          }
        })(),
        stringify(),
        createWriteStream(outPath)
      );

      paths.push(outPath);
      rowCounts.push(batchRows.length);
    }

    return { paths, rowCounts };
  }

  async extractUrls(filePath: string, mappings: MappingConfig[]): Promise<string[]> {
    const urlMappers = ['original', 'rendition', 'thumb'];
    const urlFields = mappings
      .filter((m) => urlMappers.includes(m.mapper))
      .map((m) => m.field);

    if (urlFields.length === 0) return [];

    return new Promise((resolve, reject) => {
      const urls: string[] = [];

      createReadStream(filePath)
        .pipe(parse({ columns: true, skip_empty_lines: true, trim: true }))
        .on('data', (row: Record<string, string>) => {
          for (const field of urlFields) {
            const val = row[field]?.trim();
            if (val && (val.startsWith('http://') || val.startsWith('https://'))) {
              urls.push(val);
            }
          }
        })
        .on('end', () => resolve(urls))
        .on('error', reject);
    });
  }
}
