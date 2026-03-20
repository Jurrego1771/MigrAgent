import { useCallback, useEffect, useState } from 'react';
import {
  Box, Typography, Button, Chip, Select, MenuItem,
  FormControl, TextField, Alert, CircularProgress,
  Collapse, Divider, IconButton, Tooltip, Table,
  TableBody, TableCell, TableHead, TableRow, alpha,
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
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { csvApi } from '../../../services/api';
import { useWizard } from '../../../context/WizardContext';
import { MappingConfig, ExtraColumn, TempCSVInfo } from '../../../types';
import { COLORS } from '../../../theme';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ALL_MAPPERS = [
  { name: 'id',               label: 'ID Único',              required: true  },
  { name: 'title',            label: 'Título',                required: true  },
  { name: 'original',         label: 'URL Origen (transcode)',required: false, strategy: 'transcode' },
  { name: 'rendition',        label: 'Rendición (upload)',    required: false, strategy: 'upload'    },
  { name: 'description',      label: 'Descripción',           required: false },
  { name: 'category',         label: 'Categoría',             required: false },
  { name: 'category_id',      label: 'ID Categoría',          required: false },
  { name: 'tag',              label: 'Tags',                  required: false },
  { name: 'thumb',            label: 'Thumbnail',             required: false },
  { name: 'published',        label: 'Publicado',             required: false },
  { name: 'date_created',     label: 'Fecha Creación',        required: false },
  { name: 'date_recorded',    label: 'Fecha Grabación',       required: false },
  { name: 'geo',              label: 'Geo Restricción',       required: false },
  { name: 'show',             label: 'Show/Serie',            required: false },
  { name: 'showSeason',       label: 'Temporada',             required: false },
  { name: 'showSeasonEpisode',label: 'Episodio',              required: false },
  { name: 'custom',           label: 'Atributo Custom',       required: false },
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
    accountValidation,
  } = useWizard();
  const { tempFile, mappings, extraColumns } = csvStep;
  const { migrationStrategy, suggestCategoryField } = accountValidation;

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // Inicializar sugerencia de category cuando llega desde paso 2
  useEffect(() => {
    if (suggestCategoryField && !extraColumns.find((c) => c.name === 'category')) {
      setExtraColumns([
        ...extraColumns,
        { name: 'category', defaultValue: '', reason: 'Necesario para asignación masiva de publicidad' },
      ]);
    }
  }, [suggestCategoryField]); // eslint-disable-line

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const info = await csvApi.uploadTemp(file);
      setCsvStep({ tempFile: info, normalizedTempId: null });

      // Auto-mapear con los detectados
      const autoMappings: MappingConfig[] = info.detectedMappings
        .filter((d) => d.suggestedMapper)
        .map((d) => ({ mapper: d.suggestedMapper, field: d.field }));
      setMappings(autoMappings);
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
    setCsvStep({ tempFile: null, mappings: [], normalizedTempId: null });
    setMappings([]);
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

      {/* Tabla de mapeo */}
      {tempFile && (
        <>
          {/* Alertas de campos requeridos */}
          {missingRequired.length > 0 && (
            <Alert severity="warning" icon={<WarnIcon fontSize="small" />} sx={{ fontSize: '0.82rem' }}>
              Campos requeridos sin asignar: <strong>{missingRequired.join(', ')}</strong>
            </Alert>
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
