import { Request, Response } from 'express';
import { CSVValidatorService } from '../services/csv-validator.service.js';
import { URLValidatorService } from '../services/url-validator.service.js';
import { MappingConfig, TransformationRule } from '../types/index.js';
import { PrismaClient } from '@prisma/client';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');

// Asegurar que exista el directorio temporal
fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});

const csvValidator = new CSVValidatorService();
const urlValidator = new URLValidatorService();
const prisma = new PrismaClient();

export class CSVController {
  // POST /api/csv/analyze - Analizar CSV y detectar campos
  static async analyze(req: Request, res: Response) {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Archivo CSV requerido' });
    }

    try {
      // Obtener headers
      const headers = await csvValidator.getHeaders(file.path);

      // Validar sin mappings para auto-detectar
      const result = await csvValidator.validateCSV(file.path, undefined, {
        checkUrls: false,
        sampleSize: 10,
      });

      // Limpiar archivo temporal
      await fs.unlink(file.path).catch(() => {});

      res.json({
        headers,
        rowCount: result.totalRows,
        detectedMappings: result.detectedMappings,
        emptyFields: result.emptyFields,
        preview: result.preview,
        warnings: result.warnings.filter((w) => w.row === 0), // Solo advertencias globales
      });
    } catch (error) {
      // Limpiar archivo temporal en caso de error
      await fs.unlink(file.path).catch(() => {});
      throw error;
    }
  }

  // POST /api/csv/validate - Validar CSV con mappings
  static async validate(req: Request, res: Response) {
    const file = req.file;
    const { mappings, checkUrls } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'Archivo CSV requerido' });
    }

    try {
      const parsedMappings = mappings ? JSON.parse(mappings) as MappingConfig[] : undefined;

      const result = await csvValidator.validateCSV(file.path, parsedMappings, {
        checkUrls: checkUrls !== 'false',
      });

      // Limpiar archivo temporal
      await fs.unlink(file.path).catch(() => {});

      res.json(result);
    } catch (error) {
      await fs.unlink(file.path).catch(() => {});
      throw error;
    }
  }

  // POST /api/csv/check-urls - Verificar URLs específicas
  static async checkUrls(req: Request, res: Response) {
    const { urls } = req.body as { urls: string[] };

    if (!urls || !Array.isArray(urls)) {
      return res.status(400).json({ error: 'Lista de URLs requerida' });
    }

    if (urls.length > 50) {
      return res.status(400).json({ error: 'Máximo 50 URLs por solicitud' });
    }

    const results = await urlValidator.checkUrls(urls);

    // Resumen
    const summary = {
      total: results.length,
      accessible: results.filter((r) => r.accessible).length,
      withRateLimit: results.filter((r) => r.hasRateLimit).length,
      failed: results.filter((r) => !r.accessible).length,
      totalSize: results.reduce((acc, r) => acc + (r.contentLength || 0), 0),
      avgResponseTime:
        results.reduce((acc, r) => acc + (r.responseTime || 0), 0) / results.length,
    };

    res.json({
      summary,
      results,
    });
  }

  // POST /api/csv/check-url - Verificar una URL específica
  static async checkSingleUrl(req: Request, res: Response) {
    const { url } = req.body as { url: string };

    if (!url) {
      return res.status(400).json({ error: 'URL requerida' });
    }

    const result = await urlValidator.checkUrl(url);

    // Formatear tamaño y duración si están disponibles
    const formatted = {
      ...result,
      formattedSize: result.contentLength
        ? urlValidator.formatFileSize(result.contentLength)
        : undefined,
      formattedDuration: result.duration
        ? urlValidator.formatDuration(result.duration)
        : undefined,
    };

    res.json(formatted);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Endpoints de archivos temporales (wizard)
  // ──────────────────────────────────────────────────────────────────────────

  // POST /api/csv/temp — sube un CSV, lo analiza y persiste en temp dir
  static async uploadTemp(req: Request, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'Archivo CSV requerido' });

    const tempId = uuidv4();
    const destPath = path.join(TEMP_DIR, `${tempId}.csv`);

    try {
      await fs.rename(file.path, destPath);

      const [headers, rowCount, analysisResult] = await Promise.all([
        csvValidator.getHeaders(destPath),
        csvValidator.getRowCount(destPath),
        csvValidator.validateCSV(destPath, undefined, { checkUrls: false, sampleSize: 5 }),
      ]);

      res.json({
        tempId,
        fileName: file.originalname,
        headers,
        rowCount,
        detectedMappings: analysisResult.detectedMappings || [],
        emptyFields: analysisResult.emptyFields,
        preview: analysisResult.preview,
        warnings: analysisResult.warnings.filter((w) => w.row === 0),
      });
    } catch (error) {
      await fs.unlink(destPath).catch(() => {});
      await fs.unlink(file.path).catch(() => {});
      throw error;
    }
  }

  // POST /api/csv/temp/:id/normalize — genera CSV normalizado con columnas extra y reglas de transformación
  static async normalizeTemp(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { extraColumns = [], transformationRules = [], skipDuplicateIds = [], idColumn } = req.body as {
      extraColumns?: { name: string; defaultValue: string }[];
      transformationRules?: TransformationRule[];
      skipDuplicateIds?: string[];
      idColumn?: string;
    };

    const inputPath = path.join(TEMP_DIR, `${id}.csv`);

    try {
      await fs.access(inputPath);
    } catch {
      return res.status(404).json({ error: 'Archivo temporal no encontrado. Sube el CSV nuevamente.' });
    }

    const normalizedId = uuidv4();
    const outputPath = path.join(TEMP_DIR, `${normalizedId}.csv`);

    const skipSet = new Set(skipDuplicateIds);
    const result = await csvValidator.normalizeCSV(
      inputPath, outputPath, extraColumns, transformationRules, skipSet, idColumn
    );

    res.json({
      normalizedTempId: normalizedId,
      rowCount: result.rowCount,
      addedColumns: result.addedColumns,
      skippedCount: result.skippedCount,
    });
  }

  // DELETE /api/csv/temp/:id — elimina archivo temporal
  static async cleanupTemp(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const filePath = path.join(TEMP_DIR, `${id}.csv`);

    await fs.unlink(filePath).catch(() => {});
    res.json({ success: true });
  }

  // GET /api/csv/temp/:id/download — descarga el archivo normalizado
  static async downloadTemp(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const filePath = path.join(TEMP_DIR, `${id}.csv`);

    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="normalized-${id}.csv"`);
    res.sendFile(filePath);
  }

  // POST /api/csv/temp/:id/extract-urls — extrae URLs del CSV según mappings
  static async extractUrlsFromTemp(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { mappings = [] } = req.body as { mappings: MappingConfig[] };

    const filePath = path.join(TEMP_DIR, `${id}.csv`);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo temporal no encontrado' });
    }

    const urls = await csvValidator.extractUrls(filePath, mappings);
    res.json({ urls, count: urls.length });
  }

  // POST /api/csv/temp/:id/validate-urls — verifica accesibilidad de todas las URLs
  static async validateUrlsFromTemp(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { mappings = [], concurrency = 8, samplePercent = 100 } = req.body as {
      mappings: MappingConfig[];
      concurrency?: number;
      samplePercent?: number;
    };

    const filePath = path.join(TEMP_DIR, `${id}.csv`);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo temporal no encontrado' });
    }

    const allUrls = await csvValidator.extractUrls(filePath, mappings);
    if (allUrls.length === 0) {
      return res.json({
        results: [],
        summary: { total: 0, accessible: 0, failed: 0, withRateLimit: 0, sampledFrom: 0, samplePercent: 100 },
      });
    }

    // Muestreo aleatorio si samplePercent < 100
    const clampedPercent = Math.min(100, Math.max(1, samplePercent));
    const sampleSize = Math.max(1, Math.ceil(allUrls.length * clampedPercent / 100));
    const urls = clampedPercent < 100
      ? allUrls.slice().sort(() => Math.random() - 0.5).slice(0, sampleSize)
      : allUrls;

    const results = await urlValidator.checkUrls(urls, Math.min(concurrency, 20));

    // Agrupar por dominio
    const byDomain: Record<string, { total: number; accessible: number; rateLimited: number }> = {};
    for (const r of results) {
      try {
        const host = new URL(r.url).hostname;
        if (!byDomain[host]) byDomain[host] = { total: 0, accessible: 0, rateLimited: 0 };
        byDomain[host].total++;
        if (r.accessible) byDomain[host].accessible++;
        if (r.hasRateLimit) byDomain[host].rateLimited++;
      } catch {
        // URL malformada
      }
    }

    const summary = {
      total: results.length,
      accessible: results.filter((r) => r.accessible).length,
      failed: results.filter((r) => !r.accessible).length,
      withRateLimit: results.filter((r) => r.hasRateLimit).length,
      byDomain,
      sampledFrom: allUrls.length,
      samplePercent: clampedPercent,
    };

    res.json({ results, summary });
  }

  // POST /api/csv/temp/:id/compare-report — cruza IDs del CSV actual contra un reporte SM2 (CSV o ZIP)
  // También importa los IDs con migrationStatus=done al historial de MigratedItem
  static async compareWithReport(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { idField } = req.body as { idField?: string };
    const reportFile = req.file;

    if (!reportFile) return res.status(400).json({ error: 'Archivo de reporte requerido' });
    if (!idField) return res.status(400).json({ error: 'Campo ID requerido (idField)' });

    const currentPath = path.join(TEMP_DIR, `${id}.csv`);
    try {
      await fs.access(currentPath);
    } catch {
      await fs.unlink(reportFile.path).catch(() => {});
      return res.status(404).json({ error: 'Archivo CSV temporal no encontrado' });
    }

    // Si es ZIP, extraer el CSV interno
    let csvReportPath = reportFile.path;
    let extractedTemp: string | null = null;
    const isZip = reportFile.originalname?.toLowerCase().endsWith('.zip') ||
                  reportFile.mimetype === 'application/zip' ||
                  reportFile.mimetype === 'application/x-zip-compressed';

    if (isZip) {
      try {
        const zip = new AdmZip(reportFile.path);
        const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith('.csv'));
        if (!csvEntry) {
          await fs.unlink(reportFile.path).catch(() => {});
          return res.status(400).json({ error: 'El ZIP no contiene ningún archivo CSV' });
        }
        extractedTemp = path.join(TEMP_DIR, `report-${uuidv4()}.csv`);
        await fs.writeFile(extractedTemp, csvEntry.getData());
        csvReportPath = extractedTemp;
      } catch {
        await fs.unlink(reportFile.path).catch(() => {});
        return res.status(400).json({ error: 'Error al descomprimir el ZIP' });
      }
    }

    try {
      // Parsear reporte SM2 para obtener IDs migrados exitosamente
      const reportParsed = await csvValidator.parseReportIds(csvReportPath);
      const importedIds = reportParsed.ids;

      // Guardar IDs done en MigratedItem (ignorar duplicados)
      let importedCount = 0;
      if (importedIds.length > 0) {
        const existing = await prisma.migratedItem.findMany({
          where: { itemId: { in: importedIds } },
          select: { itemId: true },
        });
        const existingSet = new Set(existing.map((e) => e.itemId));
        const newIds = importedIds.filter((id) => !existingSet.has(id));

        if (newIds.length > 0) {
          await prisma.migratedItem.createMany({
            data: newIds.map((itemId) => ({ itemId, source: 'report' })),
          });
          importedCount = newIds.length;
        }
      }

      // Cruzar contra el CSV actual para detectar duplicados en el flujo actual
      const currentIds = await csvValidator.extractIds(currentPath, idField);
      const reportIdSet = new Set(importedIds);
      const duplicates = currentIds.filter((cid) => reportIdSet.has(cid));

      await fs.unlink(reportFile.path).catch(() => {});
      if (extractedTemp) await fs.unlink(extractedTemp).catch(() => {});

      res.json({
        totalCurrent: currentIds.length,
        totalReport: reportParsed.totalRows,
        duplicateCount: duplicates.length,
        duplicates: duplicates.slice(0, 100),
        hasMore: duplicates.length > 100,
        importedToHistory: importedCount, // cuántos IDs nuevos se guardaron en el historial
        doneInReport: reportParsed.doneCount,
      });
    } catch (error) {
      await fs.unlink(reportFile.path).catch(() => {});
      if (extractedTemp) await fs.unlink(extractedTemp).catch(() => {});
      throw error;
    }
  }

  // POST /api/csv/temp/:id/check-history — cruza IDs del CSV actual contra el historial de MigratedItem
  static async checkHistory(req: Request, res: Response) {
    const { id } = req.params as { id: string };
    const { idColumn } = req.body as { idColumn: string };

    if (!idColumn) return res.status(400).json({ error: 'idColumn requerido' });

    const filePath = path.join(TEMP_DIR, `${id}.csv`);
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Archivo temporal no encontrado' });
    }

    const currentIds = await csvValidator.extractIds(filePath, idColumn);
    if (currentIds.length === 0) {
      return res.json({ totalCurrent: 0, duplicateCount: 0, duplicates: [], hasMore: false });
    }

    const found = await prisma.migratedItem.findMany({
      where: { itemId: { in: currentIds } },
      select: { itemId: true },
      distinct: ['itemId'],
    });

    const duplicates = found.map((f) => f.itemId);

    res.json({
      totalCurrent: currentIds.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 200),
      hasMore: duplicates.length > 200,
    });
  }

  // GET /api/csv/mapper-options - Obtener opciones de mappers disponibles
  static async getMapperOptions(req: Request, res: Response) {
    const mappers = [
      {
        name: 'id',
        displayName: 'ID Único',
        description: 'Identificador único del contenido (obligatorio)',
        required: true,
        options: [],
      },
      {
        name: 'title',
        displayName: 'Título',
        description: 'Título del contenido (obligatorio)',
        required: true,
        options: [],
      },
      {
        name: 'original',
        displayName: 'URL de Origen',
        description: 'URL del archivo original para transcodificar',
        required: false,
        strategy: 'transcode',
        options: [
          { name: 'profile', type: 'string', description: 'Perfil de transcodificación' },
          { name: 'zone', type: 'string', description: 'Zona de procesamiento' },
        ],
      },
      {
        name: 'rendition',
        displayName: 'Rendiciones',
        description: 'URLs de archivos pre-transcodificados',
        required: false,
        strategy: 'upload',
        options: [
          { name: 'type', type: 'select', options: ['mp4', 'm4a', 'mp3'], description: 'Tipo de rendición' },
        ],
      },
      {
        name: 'description',
        displayName: 'Descripción',
        description: 'Descripción del contenido',
        required: false,
        options: [],
      },
      {
        name: 'category',
        displayName: 'Categoría',
        description: 'Nombre de la categoría/carpeta',
        required: false,
        options: [
          { name: 'parent', type: 'field', description: 'Campo para categoría padre' },
          { name: 'separator', type: 'string', description: 'Separador para jerarquía (ej: /)' },
        ],
      },
      {
        name: 'category_id',
        displayName: 'ID de Categoría',
        description: 'ID de categoría existente',
        required: false,
        options: [],
      },
      {
        name: 'tag',
        displayName: 'Tags',
        description: 'Etiquetas del contenido',
        required: false,
        options: [
          { name: 'separator', type: 'string', description: 'Separador de tags (default: ,)' },
        ],
      },
      {
        name: 'thumb',
        displayName: 'Thumbnail',
        description: 'URL de imagen de miniatura',
        required: false,
        options: [],
      },
      {
        name: 'published',
        displayName: 'Publicado',
        description: 'Estado de publicación (true/false)',
        required: false,
        options: [],
      },
      {
        name: 'date_created',
        displayName: 'Fecha de Creación',
        description: 'Fecha de creación del contenido',
        required: false,
        options: [
          { name: 'format', type: 'string', description: 'Formato de fecha (ej: YYYY-MM-DD)' },
        ],
      },
      {
        name: 'date_recorded',
        displayName: 'Fecha de Grabación',
        description: 'Fecha de grabación del contenido',
        required: false,
        options: [
          { name: 'format', type: 'string', description: 'Formato de fecha (ej: YYYY-MM-DD)' },
        ],
      },
      {
        name: 'geo',
        displayName: 'Restricciones Geo',
        description: 'Restricciones geográficas',
        required: false,
        options: [
          { name: 'type', type: 'select', options: ['allow', 'deny'], description: 'Tipo de restricción' },
        ],
      },
      {
        name: 'show',
        displayName: 'Show/Serie',
        description: 'Nombre del show o serie',
        required: false,
        options: [],
      },
      {
        name: 'showSeason',
        displayName: 'Temporada',
        description: 'Número de temporada',
        required: false,
        options: [],
      },
      {
        name: 'showSeasonEpisode',
        displayName: 'Episodio',
        description: 'Número de episodio',
        required: false,
        options: [],
      },
      {
        name: 'custom',
        displayName: 'Atributo Personalizado',
        description: 'Campo de metadatos personalizado',
        required: false,
        options: [
          { name: 'attributeName', type: 'string', description: 'Nombre del atributo en Mediastream' },
        ],
      },
    ];

    res.json(mappers);
  }
}
