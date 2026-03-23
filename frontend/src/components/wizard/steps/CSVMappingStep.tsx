import { useCallback, useEffect, useState, useRef } from 'react';
import {
  Box, Typography, Button, Chip, Select, MenuItem,
  FormControl, TextField, Alert, CircularProgress,
  Collapse, Divider, IconButton, Tooltip, Table,
  TableBody, TableCell, TableHead, TableRow, alpha,
  List, ListItem, ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Close as CloseIcon,
  Add as AddIcon,
  CheckCircle as CheckIcon,
  Warning as WarnIcon,
  AutoAwesome as AutoIcon,
  Category as CategoryIcon,
  Download as DownloadIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  OpenInNew as OpenInNewIcon,
  CompareArrows as CompareIcon,
  History as HistoryIcon,
  FilterAlt as FilterIcon,
  Bookmark as TemplateIcon,
  CleaningServices as CleanIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { csvApi, settingsApi, templateApi } from '../../../services/api';
import { useWizard } from '../../../context/WizardContext';
import { MappingConfig, ExtraColumn, TempCSVInfo, SM2Migration, Template } from '../../../types';
import Switch from '@mui/material/Switch';
import { COLORS } from '../../../theme';
import TransformationRulesEditor from './TransformationRulesEditor';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Mappers soportados por SM2 (alineados con Settings → Migration de la plataforma)
const ALL_MAPPERS = [
  { name: 'id',           label: 'ID Único (CMS)',         required: true  },
  { name: 'title',        label: 'Título',                 required: true  },
  { name: 'original',     label: 'Media Origin URL',       required: false, strategy: 'transcode' },
  { name: 'rendition',    label: 'Rendición (upload)',     required: false, strategy: 'upload'    },
  { name: 'description',  label: 'Media Description',      required: false },
  { name: 'category',     label: 'Category',               required: false },
  { name: 'tag',          label: 'Media Tags',             required: false },
  { name: 'thumb',        label: 'Media Thumbnail',        required: false },
  { name: 'published',    label: 'Media Published Status', required: false },
  { name: 'date_created', label: 'Date Created',           required: false },
  { name: 'date_recorded',label: 'Date Recorded',          required: false },
  { name: 'show',         label: 'Show',                   required: false },
];

// ---------------------------------------------------------------------------
// Dropzone
// ---------------------------------------------------------------------------

function CSVDropzone({ onFile }: { onFile: (f: File) => void }) {
  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) onFile(accepted[0]);
  }, [onFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'text/plain': ['.csv'] },
    multiple: false,
  });

  return (
    <Box
      {...getRootProps()}
      sx={{
        border: `2px dashed ${isDragActive ? COLORS.neonGreen : alpha(COLORS.charcoal, 0.7)}`,
        borderRadius: 3,
        p: 5,
        textAlign: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        background: isDragActive ? alpha(COLORS.neonGreen, 0.05) : 'transparent',
        '&:hover': {
          borderColor: alpha(COLORS.neonGreen, 0.5),
          background: alpha(COLORS.neonGreen, 0.03),
        },
      }}
    >
      <input {...getInputProps()} />
      <UploadIcon sx={{ fontSize: 40, color: isDragActive ? COLORS.neonGreen : 'text.disabled', mb: 1 }} />
      <Typography variant="body1" fontWeight={500} color={isDragActive ? COLORS.neonGreen : 'text.secondary'}>
        {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra tu CSV aquí o haz clic para seleccionar'}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
        Solo archivos .csv · máximo 100 MB
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Fila de mapeo
// ---------------------------------------------------------------------------

interface MappingRowProps {
  header: string;
  mapping: MappingConfig | undefined;
  confidence: number | undefined;
  sampleValues: string[];
  strategy: 'transcode' | 'upload';
  usedMappers: Set<string>;
  onChange: (header: string, mapper: string) => void;
}

function MappingRow({ header, mapping, confidence, sampleValues, strategy, usedMappers, onChange }: MappingRowProps) {
  const mapper = mapping?.mapper ?? '';
  const isAuto = !!confidence;
  const isRequired = ['id', 'title'].includes(mapper) ||
    (strategy === 'transcode' && mapper === 'original') ||
    (strategy === 'upload' && mapper === 'rendition');

  const confidenceColor =
    !confidence ? undefined :
    confidence >= 0.85 ? COLORS.sageGreen :
    confidence >= 0.65 ? COLORS.dustyRose :
    COLORS.mauve;

  return (
    <TableRow
      sx={{
        '&:hover': { background: alpha(COLORS.charcoal, 0.2) },
        background: isRequired ? alpha(COLORS.neonGreen, 0.03) : 'transparent',
      }}
    >
      {/* Columna CSV */}
      <TableCell sx={{ py: 1, fontFamily: 'monospace', fontSize: '0.82rem', color: 'text.primary' }}>
        {header}
      </TableCell>

      {/* Select mapper */}
      <TableCell sx={{ py: 1, width: 220 }}>
        <FormControl size="small" fullWidth>
          <Select
            value={mapper}
            onChange={(e) => onChange(header, e.target.value)}
            displayEmpty
            sx={{
              fontSize: '0.82rem',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: mapper
                  ? alpha(COLORS.neonGreen, 0.4)
                  : alpha(COLORS.charcoal, 0.6),
              },
            }}
            renderValue={(v) =>
              v ? ALL_MAPPERS.find((m) => m.name === v)?.label ?? v : (
                <Typography variant="caption" color="text.disabled">Sin asignar</Typography>
              )
            }
          >
            <MenuItem value=""><em>Sin asignar</em></MenuItem>
            <Divider />
            {ALL_MAPPERS.map((m) => {
              const disabled = usedMappers.has(m.name) && m.name !== mapper;
              const strategyMismatch =
                (m.strategy === 'transcode' && strategy !== 'transcode') ||
                (m.strategy === 'upload' && strategy !== 'upload');
              return (
                <MenuItem
                  key={m.name}
                  value={m.name}
                  disabled={disabled || strategyMismatch}
                  sx={{ fontSize: '0.82rem', gap: 1 }}
                >
                  {m.label}
                  {m.required && <Chip label="req" size="small" sx={{ height: 14, fontSize: '0.58rem', ml: 'auto' }} />}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
      </TableCell>

      {/* Badge confianza */}
      <TableCell sx={{ py: 1, width: 90 }}>
        {isAuto ? (
          <Chip
            icon={<AutoIcon style={{ fontSize: 11 }} />}
            label={`${Math.round((confidence ?? 0) * 100)}%`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: alpha(confidenceColor!, 0.15),
              color: confidenceColor,
              border: `1px solid ${alpha(confidenceColor!, 0.3)}`,
            }}
          />
        ) : (
          <Typography variant="caption" color="text.disabled">—</Typography>
        )}
      </TableCell>

      {/* Muestra */}
      <TableCell sx={{ py: 1, maxWidth: 200, overflow: 'hidden' }}>
        <Typography
          variant="caption"
          color="text.disabled"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.7rem',
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {sampleValues.filter(Boolean).slice(0, 2).join(' · ') || '—'}
        </Typography>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function CSVMappingStep() {
  const {
    csvStep, setMappings, setExtraColumns, setCsvStep,
    setTransformationRules, setSkipHistoryDuplicates, setCleanCsv, accountValidation, session,
  } = useWizard();
  const { tempFile, mappings, extraColumns, transformationRules, historyDuplicates, skipHistoryDuplicates, internalDuplicates, cleanCsv } = csvStep;
  const { migrationStrategy, suggestCategoryField } = accountValidation;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Alerta de migraciones activas en SM2
  const [sm2Migrations, setSm2Migrations] = useState<SM2Migration[]>([]);
  const [migrationAlertDismissed, setMigrationAlertDismissed] = useState(false);

  // Template detectado automáticamente
  const [detectedTemplate, setDetectedTemplate] = useState<Template | null>(null);
  const [templateDismissed, setTemplateDismissed] = useState(false);

  // Chequeo automático de historial e internos
  const [checkingHistory, setCheckingHistory] = useState(false);
  const [checkingInternalDups, setCheckingInternalDups] = useState(false);

  // Herramienta de comparación de reportes
  const [compareOpen, setCompareOpen] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<{
    totalCurrent: number; totalReport: number;
    duplicateCount: number; duplicates: string[]; hasMore: boolean;
    importedToHistory: number; doneInReport: number;
  } | null>(null);
  const reportInputRef = useRef<HTMLInputElement>(null);

  // Inicializar sugerencia de category cuando llega desde paso 2
  useEffect(() => {
    if (suggestCategoryField && !extraColumns.find((c) => c.name === 'category')) {
      setExtraColumns([
        ...extraColumns,
        { name: 'category', defaultValue: '', reason: 'Necesario para asignación masiva de publicidad' },
      ]);
    }
  }, [suggestCategoryField]); // eslint-disable-line

  // Cargar migraciones activas de SM2 al montar
  useEffect(() => {
    settingsApi.getMediastreamMigrations()
      .then((list) => setSm2Migrations(list))
      .catch(() => {}); // silencioso — no bloquear flujo principal
  }, []); // eslint-disable-line

  // Auto-chequear historial e internos cuando se asigna la columna id
  const idMapping = mappings.find((m) => m.mapper === 'id');
  useEffect(() => {
    if (!tempFile?.tempId || !idMapping?.field) {
      setCsvStep({ historyDuplicates: null, internalDuplicates: null });
      return;
    }
    let cancelled = false;

    setCheckingHistory(true);
    csvApi.checkHistory(tempFile.tempId, idMapping.field)
      .then((result) => {
        if (cancelled) return;
        setCsvStep({
          historyDuplicates: result.duplicateCount > 0
            ? { count: result.duplicateCount, ids: result.duplicates }
            : null,
        });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCheckingHistory(false); });

    setCheckingInternalDups(true);
    csvApi.checkInternalDuplicates(tempFile.tempId, idMapping.field)
      .then((result) => {
        if (cancelled) return;
        setCsvStep({ internalDuplicates: result.count > 0 ? result : null });
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setCheckingInternalDups(false); });

    return () => { cancelled = true; };
  }, [tempFile?.tempId, idMapping?.field]); // eslint-disable-line

  const handleCompareReport = async (file: File) => {
    if (!tempFile?.tempId) return;
    const idMapping = mappings.find((m) => m.mapper === 'id');
    if (!idMapping) return;

    setComparing(true);
    setCompareResult(null);
    try {
      const result = await csvApi.compareWithReport(tempFile.tempId, file, idMapping.field);
      setCompareResult(result);
    } catch {
      // error silencioso — el usuario puede reintentar
    } finally {
      setComparing(false);
    }
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    setDetectedTemplate(null);
    setTemplateDismissed(false);
    try {
      const info = await csvApi.uploadTemp(file);
      setCsvStep({ tempFile: info, normalizedTempId: null });

      // Auto-mapear con los detectados
      const autoMappings: MappingConfig[] = info.detectedMappings
        .filter((d) => d.suggestedMapper)
        .map((d) => ({ mapper: d.suggestedMapper, field: d.field }));
      setMappings(autoMappings);

      // Detectar template guardado que coincida con estos headers
      templateApi.detect(info.headers)
        .then(({ found, template }) => {
          if (found && template) setDetectedTemplate(template);
        })
        .catch(() => {});
    } catch (err: any) {
      setUploadError(err?.response?.data?.error || err.message || 'Error al procesar el archivo.');
    } finally {
      setUploading(false);
    }
  };

  const handleChangeMapper = (header: string, mapper: string) => {
    const newMappings = mappings.filter((m) => m.field !== header);
    if (mapper) newMappings.push({ mapper, field: header });
    setMappings(newMappings);
  };

  const handleRemoveFile = async () => {
    if (tempFile?.tempId) {
      csvApi.cleanupTemp(tempFile.tempId).catch(() => {});
    }
    setCsvStep({ tempFile: null, mappings: [], normalizedTempId: null, transformationRules: [], historyDuplicates: null, skipHistoryDuplicates: false });
    setMappings([]);
    setDetectedTemplate(null);
    setTemplateDismissed(false);
  };

  const applyTemplate = (template: Template) => {
    setMappings(template.mappings);
    setCsvStep({ templateId: template.id });
    setDetectedTemplate(null);
    setTemplateDismissed(true);
  };

  const usedMappers = new Set(mappings.map((m) => m.mapper));

  // Validaciones de mapeo
  const hasId = mappings.some((m) => m.mapper === 'id');
  const hasTitle = mappings.some((m) => m.mapper === 'title');
  const hasUrl =
    mappings.some((m) => m.mapper === 'original') ||
    mappings.some((m) => m.mapper === 'rendition');
  const missingRequired = [
    !hasId && 'ID Único',
    !hasTitle && 'Título',
    !hasUrl && (migrationStrategy === 'transcode' ? 'URL Origen' : 'Rendición'),
  ].filter(Boolean) as string[];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Archivo CSV y mapeo de campos
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Carga tu archivo de migración. El sistema detectará los campos automáticamente
          — puedes ajustar el mapeo antes de continuar.
        </Typography>
      </Box>

      {/* ── Alerta migraciones activas en SM2 ── */}
      {sm2Migrations.length > 0 && !migrationAlertDismissed && (
        <Box
          sx={{
            p: 2, borderRadius: 2,
            border: `1px solid ${alpha('#F5A623', 0.4)}`,
            background: alpha('#F5A623', 0.06),
            display: 'flex', gap: 1.5, alignItems: 'flex-start',
          }}
        >
          <WarnIcon sx={{ color: '#F5A623', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#F5A623' }}>
              Tienes {sm2Migrations.length} migración{sm2Migrations.length > 1 ? 'es' : ''} anterior{sm2Migrations.length > 1 ? 'es' : ''} en SM2
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
              Si tu CSV contiene IDs que ya fueron migrados, SM2 los rechazará con error de duplicado.
              Revisa tus migraciones antes de continuar.
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              {sm2Migrations.slice(0, 3).map((m) => (
                <Chip
                  key={m._id}
                  label={`${m.name}${m.stats ? ` · ${m.stats.done} ok / ${m.stats.error} err` : ''}`}
                  size="small"
                  sx={{ fontSize: '0.7rem', background: alpha('#F5A623', 0.12), color: '#F5A623' }}
                />
              ))}
              {sm2Migrations.length > 3 && (
                <Chip label={`+${sm2Migrations.length - 3} más`} size="small" sx={{ fontSize: '0.7rem' }} />
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, flexShrink: 0 }}>
            <Button
              size="small"
              endIcon={<OpenInNewIcon fontSize="small" />}
              href={`${session?.apiUrl ?? 'https://platform.mediastre.am'}/settings/migration`}
              target="_blank"
              sx={{ fontSize: '0.72rem', color: '#F5A623', borderColor: alpha('#F5A623', 0.4) }}
              variant="outlined"
            >
              Ver en SM2
            </Button>
            <Button
              size="small"
              onClick={() => setMigrationAlertDismissed(true)}
              sx={{ fontSize: '0.72rem', color: 'text.disabled' }}
            >
              Ignorar
            </Button>
          </Box>
        </Box>
      )}

      {/* ── Template detectado ── */}
      {detectedTemplate && !templateDismissed && tempFile && (
        <Box
          sx={{
            p: 2, borderRadius: 2,
            border: `1px solid ${alpha(COLORS.neonGreen, 0.4)}`,
            background: alpha(COLORS.neonGreen, 0.06),
            display: 'flex', gap: 1.5, alignItems: 'center',
          }}
        >
          <TemplateIcon sx={{ color: COLORS.neonGreen, fontSize: 20, flexShrink: 0 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.neonGreen }}>
              Template detectado: {detectedTemplate.name}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Los headers del CSV coinciden con este template guardado.
              ¿Quieres aplicar su configuración de mapeo?
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => applyTemplate(detectedTemplate)}
              sx={{ fontSize: '0.72rem', color: COLORS.neonGreen, borderColor: alpha(COLORS.neonGreen, 0.4) }}
            >
              Aplicar
            </Button>
            <Button
              size="small"
              onClick={() => setTemplateDismissed(true)}
              sx={{ fontSize: '0.72rem', color: 'text.disabled' }}
            >
              Ignorar
            </Button>
          </Box>
        </Box>
      )}

      {/* Dropzone o info del archivo */}
      {!tempFile ? (
        <Box>
          {uploading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 5, justifyContent: 'center' }}>
              <CircularProgress size={28} sx={{ color: COLORS.neonGreen }} />
              <Typography color="text.secondary">Analizando archivo…</Typography>
            </Box>
          ) : (
            <CSVDropzone onFile={handleFile} />
          )}
          {uploadError && <Alert severity="error" sx={{ mt: 1.5, fontSize: '0.82rem' }}>{uploadError}</Alert>}
        </Box>
      ) : (
        /* Info del archivo cargado */
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha(COLORS.neonGreen, 0.3)}`,
            background: alpha(COLORS.neonGreen, 0.05),
          }}
        >
          <CheckIcon sx={{ color: COLORS.neonGreen, fontSize: 22 }} />
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>
            <Typography variant="subtitle2" noWrap>{tempFile.fileName}</Typography>
            <Typography variant="caption" color="text.disabled">
              {tempFile.rowCount.toLocaleString()} filas · {tempFile.headers.length} columnas
            </Typography>
          </Box>
          <Tooltip title="Cambiar archivo">
            <IconButton size="small" onClick={handleRemoveFile} sx={{ color: 'text.disabled' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )}

      {/* ── Diagnóstico del CSV ── */}
      {tempFile && (() => {
        const emptyEntries = Object.entries(tempFile.emptyFields ?? {}).filter(([, count]) => count > 0);
        const criticalEmpty = emptyEntries.filter(([col]) =>
          mappings.some((m) => m.field === col && ['id', 'title', 'original', 'rendition'].includes(m.mapper))
        );
        const optionalEmpty = emptyEntries.filter(([col]) =>
          !mappings.some((m) => m.field === col && ['id', 'title', 'original', 'rendition'].includes(m.mapper))
        );
        const hasDiagnosis = criticalEmpty.length > 0 || optionalEmpty.length > 0 || internalDuplicates;
        if (!hasDiagnosis && !checkingInternalDups) return null;

        const issueCount =
          (criticalEmpty.length > 0 ? 1 : 0) +
          (optionalEmpty.length > 0 ? 1 : 0) +
          (internalDuplicates ? 1 : 0);

        return (
          <Box
            sx={{
              border: `1px solid ${alpha(criticalEmpty.length > 0 ? COLORS.alertRed : '#F5A623', 0.4)}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            {/* Header del diagnóstico */}
            <Box
              sx={{
                px: 2, py: 1.25,
                background: alpha(criticalEmpty.length > 0 ? COLORS.alertRed : '#F5A623', 0.08),
                display: 'flex', alignItems: 'center', gap: 1,
              }}
            >
              {criticalEmpty.length > 0
                ? <ErrorIcon sx={{ fontSize: 18, color: COLORS.alertRed, flexShrink: 0 }} />
                : <WarnIcon sx={{ fontSize: 18, color: '#F5A623', flexShrink: 0 }} />
              }
              <Typography variant="caption" fontWeight={700} sx={{ color: criticalEmpty.length > 0 ? COLORS.alertRed : '#F5A623', flexGrow: 1, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Diagnóstico del CSV — {issueCount} problema{issueCount !== 1 ? 's' : ''} detectado{issueCount !== 1 ? 's' : ''}
              </Typography>
              {hasDiagnosis && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <CleanIcon sx={{ fontSize: 15, color: cleanCsv ? COLORS.sageGreen : 'text.disabled' }} />
                  <Typography variant="caption" color={cleanCsv ? COLORS.sageGreen : 'text.disabled'}>
                    Limpiar CSV
                  </Typography>
                  <Switch
                    size="small"
                    checked={cleanCsv}
                    onChange={(e) => setCleanCsv(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-thumb': { bgcolor: cleanCsv ? COLORS.sageGreen : undefined },
                      '& .MuiSwitch-track': { bgcolor: cleanCsv ? alpha(COLORS.sageGreen, 0.5) : undefined },
                    }}
                  />
                </Box>
              )}
            </Box>

            {/* Cuerpo del diagnóstico */}
            <Box sx={{ px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              {/* Campos críticos vacíos */}
              {criticalEmpty.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <ErrorIcon sx={{ fontSize: 15, color: COLORS.alertRed, mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="caption" fontWeight={600} sx={{ color: COLORS.alertRed }}>
                      Campos críticos con valores vacíos
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {criticalEmpty.map(([col, count]) => (
                        <Chip
                          key={col}
                          label={`${col} · ${count} vacío${count !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{ fontSize: '0.68rem', bgcolor: alpha(COLORS.alertRed, 0.12), color: COLORS.alertRed, border: `1px solid ${alpha(COLORS.alertRed, 0.3)}` }}
                        />
                      ))}
                    </Box>
                    {cleanCsv && (
                      <Typography variant="caption" sx={{ color: COLORS.sageGreen, display: 'block', mt: 0.5 }}>
                        Se eliminarán las filas afectadas al normalizar
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}

              {/* Campos opcionales vacíos */}
              {optionalEmpty.length > 0 && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <WarnIcon sx={{ fontSize: 15, color: '#F5A623', mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography variant="caption" fontWeight={600} sx={{ color: '#F5A623' }}>
                      Campos opcionales con valores vacíos
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {optionalEmpty.map(([col, count]) => (
                        <Chip
                          key={col}
                          label={`${col} · ${count} vacío${count !== 1 ? 's' : ''}`}
                          size="small"
                          sx={{ fontSize: '0.68rem', bgcolor: alpha('#F5A623', 0.1), color: '#F5A623', border: `1px solid ${alpha('#F5A623', 0.3)}` }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Duplicados internos */}
              {(checkingInternalDups || internalDuplicates) && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  {checkingInternalDups
                    ? <CircularProgress size={13} sx={{ color: 'text.disabled', mt: 0.2, flexShrink: 0 }} />
                    : <WarnIcon sx={{ fontSize: 15, color: '#F5A623', mt: 0.2, flexShrink: 0 }} />
                  }
                  <Box>
                    {checkingInternalDups ? (
                      <Typography variant="caption" color="text.disabled">Buscando IDs duplicados…</Typography>
                    ) : internalDuplicates && (
                      <>
                        <Typography variant="caption" fontWeight={600} sx={{ color: '#F5A623' }}>
                          {internalDuplicates.count} ID{internalDuplicates.count !== 1 ? 's' : ''} repetido{internalDuplicates.count !== 1 ? 's' : ''} dentro del CSV
                        </Typography>
                        {cleanCsv && (
                          <Typography variant="caption" sx={{ color: COLORS.sageGreen, display: 'block', mt: 0.25 }}>
                            Se conservará solo la primera ocurrencia de cada ID
                          </Typography>
                        )}
                      </>
                    )}
                  </Box>
                </Box>
              )}

              {/* Resumen limpieza */}
              {cleanCsv && (criticalEmpty.length > 0 || internalDuplicates) && (
                <Box
                  sx={{
                    mt: 0.5, pt: 1,
                    borderTop: `1px solid ${alpha(COLORS.sageGreen, 0.2)}`,
                    display: 'flex', alignItems: 'center', gap: 1,
                  }}
                >
                  <CleanIcon sx={{ fontSize: 14, color: COLORS.sageGreen }} />
                  <Typography variant="caption" sx={{ color: COLORS.sageGreen }}>
                    El CSV se limpiará automáticamente al avanzar al paso siguiente
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        );
      })()}

      {/* Tabla de mapeo */}
      {tempFile && (
        <>
          {/* Alertas de campos requeridos */}
          {missingRequired.length > 0 && (
            <Alert severity="warning" icon={<WarnIcon fontSize="small" />} sx={{ fontSize: '0.82rem' }}>
              Campos requeridos sin asignar: <strong>{missingRequired.join(', ')}</strong>
            </Alert>
          )}

          {/* ── Banner de deduplicación por historial ── */}
          {checkingHistory && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
              <CircularProgress size={14} sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" color="text.disabled">Consultando historial de migraciones…</Typography>
            </Box>
          )}
          {!checkingHistory && historyDuplicates && historyDuplicates.count > 0 && (
            <Box
              sx={{
                p: 2, borderRadius: 2,
                border: `1px solid ${alpha('#9C27B0', 0.4)}`,
                background: alpha('#9C27B0', 0.06),
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                <HistoryIcon sx={{ color: '#CE93D8', fontSize: 20, mt: 0.2, flexShrink: 0 }} />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ color: '#CE93D8' }}>
                    {historyDuplicates.count} items ya migrados en el historial
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mt={0.3}>
                    Estos IDs aparecen en migraciones anteriores completadas exitosamente o en reportes importados.
                    SM2 los rechazará si los incluyes de nuevo.
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  <FilterIcon sx={{ fontSize: 16, color: skipHistoryDuplicates ? '#CE93D8' : 'text.disabled' }} />
                  <Typography variant="caption" color={skipHistoryDuplicates ? '#CE93D8' : 'text.disabled'}>
                    Omitir duplicados
                  </Typography>
                  <Switch
                    size="small"
                    checked={skipHistoryDuplicates}
                    onChange={(e) => setSkipHistoryDuplicates(e.target.checked)}
                    sx={{
                      '& .MuiSwitch-thumb': { bgcolor: skipHistoryDuplicates ? '#9C27B0' : undefined },
                      '& .MuiSwitch-track': { bgcolor: skipHistoryDuplicates ? alpha('#9C27B0', 0.5) : undefined },
                    }}
                  />
                </Box>
              </Box>
              {skipHistoryDuplicates && (
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: '#CE93D8' }}>
                  Se omitirán <strong>{historyDuplicates.count}</strong> filas al normalizar. El CSV final tendrá{' '}
                  <strong>{(tempFile?.rowCount ?? 0) - historyDuplicates.count}</strong> items.
                </Typography>
              )}
            </Box>
          )}

          <Box
            sx={{
              border: `1px solid ${alpha(COLORS.charcoal, 0.6)}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                px: 2, py: 1.25,
                background: alpha(COLORS.charcoal, 0.2),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.disabled' }}>
                Mapeo de campos — {mappings.length}/{tempFile.headers.length} asignados
              </Typography>
              <Chip
                label={`${mappings.length} mapeados`}
                size="small"
                sx={{
                  bgcolor: mappings.length > 0 ? alpha(COLORS.sageGreen, 0.15) : alpha(COLORS.charcoal, 0.3),
                  color: mappings.length > 0 ? COLORS.sageGreen : 'text.disabled',
                  fontSize: '0.68rem',
                  fontWeight: 600,
                }}
              />
            </Box>

            <Table size="small" sx={{ tableLayout: 'fixed' }}>
              <TableHead>
                <TableRow sx={{ background: alpha(COLORS.darkCard, 0.6) }}>
                  <TableCell sx={{ color: 'text.disabled', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Columna CSV
                  </TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 220 }}>
                    Mapper SM2
                  </TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: 90 }}>
                    Confianza
                  </TableCell>
                  <TableCell sx={{ color: 'text.disabled', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Muestra
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tempFile.headers.map((header) => {
                  const detected = tempFile.detectedMappings.find((d) => d.field === header);
                  const current = mappings.find((m) => m.field === header);
                  return (
                    <MappingRow
                      key={header}
                      header={header}
                      mapping={current}
                      confidence={detected?.confidence}
                      sampleValues={detected?.sampleValues ?? []}
                      strategy={migrationStrategy}
                      usedMappers={usedMappers}
                      onChange={handleChangeMapper}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </Box>

          {/* Columnas adicionales */}
          <ExtraColumnsSection
            extraColumns={extraColumns}
            suggestCategory={suggestCategoryField}
            onChange={setExtraColumns}
          />

          {/* Reglas de transformación */}
          <TransformationRulesEditor
            rules={transformationRules}
            csvHeaders={tempFile.headers}
            onChange={setTransformationRules}
          />

          {/* Vista previa */}
          {tempFile.preview.length > 0 && (
            <Box>
              <Button
                size="small"
                variant="text"
                onClick={() => setShowPreview((v) => !v)}
                endIcon={showPreview ? <CollapseIcon /> : <ExpandIcon />}
                sx={{ color: 'text.secondary', mb: 1 }}
              >
                Vista previa del CSV ({tempFile.preview.length} filas)
              </Button>
              <Collapse in={showPreview}>
                <PreviewTable preview={tempFile.preview} mappings={mappings} />
              </Collapse>
            </Box>
          )}

          {/* ── Herramienta de comparación de reportes ── */}
          {mappings.find((m) => m.mapper === 'id') && (
            <Box
              sx={{
                border: `1px solid ${alpha(COLORS.darkBorder, 0.6)}`,
                borderRadius: 2, overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: 2, py: 1.25,
                  background: alpha(COLORS.charcoal, 0.15),
                  display: 'flex', alignItems: 'center', gap: 1,
                  cursor: 'pointer', userSelect: 'none',
                }}
                onClick={() => { setCompareOpen((v) => !v); setCompareResult(null); }}
              >
                <CompareIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ flexGrow: 1 }}>
                  Comparar con reporte de migración anterior
                </Typography>
                {compareOpen ? <CollapseIcon sx={{ fontSize: 18, color: 'text.disabled' }} /> : <ExpandIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
              </Box>
              <Collapse in={compareOpen}>
                <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Sube el reporte descargado desde SM2 (<strong>.zip</strong> o <strong>.csv</strong>) para detectar
                    IDs ya migrados. Los IDs con status <em>done</em> se guardarán automáticamente en el historial.
                  </Typography>
                  <input
                    ref={reportInputRef}
                    type="file"
                    accept=".csv,.zip"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleCompareReport(f);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={comparing ? <CircularProgress size={14} /> : <CompareIcon />}
                    disabled={comparing}
                    onClick={() => reportInputRef.current?.click()}
                    sx={{ alignSelf: 'flex-start', borderColor: alpha(COLORS.darkBorder, 0.6), color: 'text.secondary' }}
                  >
                    {comparing ? 'Comparando…' : 'Subir reporte y comparar'}
                  </Button>
                  {compareResult && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {compareResult.importedToHistory > 0 && (
                        <Alert severity="info" sx={{ fontSize: '0.82rem' }}>
                          <strong>{compareResult.importedToHistory}</strong> IDs nuevos guardados en el historial
                          ({compareResult.doneInReport} con status <em>done</em> en el reporte).
                        </Alert>
                      )}
                      {compareResult.duplicateCount === 0 ? (
                        <Alert severity="success" sx={{ fontSize: '0.82rem' }}>
                          Sin duplicados — ningún ID del CSV actual aparece en el reporte anterior.
                        </Alert>
                      ) : (
                        <Alert severity="warning" sx={{ fontSize: '0.82rem' }}>
                          <strong>{compareResult.duplicateCount} IDs duplicados</strong> de {compareResult.totalCurrent} en tu CSV
                          ya existen en el reporte ({compareResult.totalReport} filas). SM2 los rechazará.
                          {compareResult.hasMore && ' Se muestran los primeros 100.'}
                          <List dense disablePadding sx={{ mt: 1, maxHeight: 140, overflow: 'auto' }}>
                            {compareResult.duplicates.map((id) => (
                              <ListItem key={id} disablePadding>
                                <ListItemText
                                  primary={id}
                                  primaryTypographyProps={{ variant: 'caption', fontFamily: 'monospace' }}
                                />
                              </ListItem>
                            ))}
                          </List>
                        </Alert>
                      )}
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          )}

          {/* Descargar CSV normalizado */}
          {csvStep.normalizedTempId && (
            <Alert
              severity="success"
              icon={<CheckIcon />}
              sx={{ fontSize: '0.82rem' }}
              action={
                <Button
                  size="small"
                  startIcon={<DownloadIcon />}
                  href={csvApi.downloadTemp(csvStep.normalizedTempId)}
                  download
                  sx={{ color: COLORS.sageGreen }}
                >
                  Descargar
                </Button>
              }
            >
              CSV normalizado listo. Se usará en la migración final.
            </Alert>
          )}
        </>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sección de columnas adicionales
// ---------------------------------------------------------------------------

function ExtraColumnsSection({
  extraColumns,
  suggestCategory,
  onChange,
}: {
  extraColumns: ExtraColumn[];
  suggestCategory: boolean;
  onChange: (cols: ExtraColumn[]) => void;
}) {
  const addColumn = () => {
    onChange([...extraColumns, { name: '', defaultValue: '', reason: 'Manual' }]);
  };

  const update = (i: number, field: keyof ExtraColumn, value: string) => {
    const updated = [...extraColumns];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const remove = (i: number) => {
    onChange(extraColumns.filter((_, idx) => idx !== i));
  };

  return (
    <Box
      sx={{
        border: `1px solid ${alpha(COLORS.charcoal, 0.5)}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2, py: 1.25,
          background: alpha(COLORS.charcoal, 0.15),
          display: 'flex',
          alignItems: 'center',
          gap: 1,
        }}
      >
        <AddIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.disabled' }}
        >
          Columnas adicionales
        </Typography>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {suggestCategory && !extraColumns.find((c) => c.name === 'category') && (
          <Alert
            severity="info"
            icon={<CategoryIcon fontSize="small" />}
            sx={{ fontSize: '0.8rem' }}
            action={
              <Button
                size="small"
                onClick={() =>
                  onChange([...extraColumns, { name: 'category', defaultValue: '', reason: 'Asignación masiva de publicidad' }])
                }
              >
                Agregar
              </Button>
            }
          >
            Se recomienda agregar la columna <strong>category</strong> para asignación masiva de publicidad.
          </Alert>
        )}

        {extraColumns.map((col, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
            <TextField
              label="Nombre columna"
              value={col.name}
              onChange={(e) => update(i, 'name', e.target.value)}
              size="small"
              sx={{ width: 200 }}
              placeholder="ej: category"
            />
            <TextField
              label="Valor por defecto"
              value={col.defaultValue}
              onChange={(e) => update(i, 'defaultValue', e.target.value)}
              size="small"
              sx={{ flexGrow: 1 }}
              placeholder="ej: Noticias > Tecnología"
            />
            <IconButton size="small" onClick={() => remove(i)} sx={{ mt: 0.5, color: 'text.disabled' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}

        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addColumn}
          sx={{
            alignSelf: 'flex-start',
            borderColor: alpha(COLORS.charcoal, 0.6),
            color: 'text.secondary',
            fontSize: '0.78rem',
          }}
        >
          Agregar columna
        </Button>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Preview table
// ---------------------------------------------------------------------------

function PreviewTable({ preview, mappings }: { preview: TempCSVInfo['preview']; mappings: MappingConfig[] }) {
  if (!preview.length) return null;
  const headers = Object.keys(preview[0].input);
  const mapped = new Set(mappings.map((m) => m.field));

  return (
    <Box
      sx={{
        overflowX: 'auto',
        borderRadius: 2,
        border: `1px solid ${alpha(COLORS.charcoal, 0.5)}`,
        maxHeight: 220,
        overflowY: 'auto',
      }}
    >
      <Table size="small" sx={{ minWidth: 500 }}>
        <TableHead>
          <TableRow sx={{ background: alpha(COLORS.charcoal, 0.2) }}>
            {headers.map((h) => (
              <TableCell key={h} sx={{ fontSize: '0.7rem', py: 0.75, fontFamily: 'monospace', color: mapped.has(h) ? COLORS.neonGreen : 'text.disabled', whiteSpace: 'nowrap' }}>
                {h}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {preview.map((row, i) => (
            <TableRow key={i}>
              {headers.map((h) => (
                <TableCell key={h} sx={{ fontSize: '0.72rem', py: 0.5, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.secondary' }}>
                  {String(row.input[h] ?? '')}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
