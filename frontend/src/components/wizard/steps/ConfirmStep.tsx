import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  alpha,
  CircularProgress,
  Divider,
  TextField,
  Switch,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton,
  Collapse,
} from '@mui/material';
import {
  RocketLaunch as RocketIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
  Description as DescriptionIcon,
  ContentCopy as CopyIcon,
  Splitscreen as BatchIcon,
  BookmarkAdd as SaveTemplateIcon,
} from '@mui/icons-material';
import { useWizard } from '../../../context/WizardContext';
import { wizardApi } from '../../../services/api';
import { BatchConfig } from '../../../types';
import { COLORS } from '../../../theme';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function ConfirmStep() {
  const { session, accountValidation, csvStep, urlValidation, markStepComplete, currentStep } =
    useWizard();

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [result, setResult] = useState<{
    migrationId: string;
    mediastreamId: string;
    isBatch?: boolean;
    batchGroupId?: string;
    totalBatches?: number;
    batches?: Array<{ migrationId: string; mediastreamId: string; index: number; rowCount: number }>;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { migrationName, migrationStrategy, contentType, hasAdvertising } = accountValidation;
  const { tempFile, mappings, extraColumns, normalizedTempId, transformationRules, templateId } = csvStep;

  const [batchConfig, setBatchConfig] = useState<BatchConfig>({
    enabled: false,
    size: 500,
    namePrefix: migrationName,
    mode: 'auto',
  });

  // Save as template
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState(migrationName || '');

  const updateBatch = (patch: Partial<BatchConfig>) =>
    setBatchConfig((prev) => ({ ...prev, ...patch }));

  const estimatedBatches =
    batchConfig.enabled && tempFile && batchConfig.size > 0
      ? Math.ceil(tempFile.rowCount / batchConfig.size)
      : null;
  const urlSummary = urlValidation.summary;

  const canSubmit =
    status === 'idle' &&
    normalizedTempId &&
    migrationName &&
    session !== null;

  const handleSubmit = async () => {
    if (!normalizedTempId || !migrationName) return;

    setStatus('submitting');
    setErrorMsg(null);

    try {
      const res = await wizardApi.createMigration({
        name: migrationName,
        strategy: migrationStrategy,
        mappings,
        normalizedTempId,
        templateId: templateId ?? undefined,
        transformationRules: transformationRules.length > 0 ? transformationRules : undefined,
        batchConfig: batchConfig.enabled ? { ...batchConfig, namePrefix: batchConfig.namePrefix || migrationName } : undefined,
        saveAsTemplate:
          saveAsTemplate && templateName.trim() && !templateId
            ? { name: templateName.trim(), expectedHeaders: tempFile?.headers ?? [] }
            : undefined,
      });
      setResult(res);
      setStatus('success');
      markStepComplete(currentStep);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Error desconocido'
          : 'Error desconocido';
      setErrorMsg(msg);
      setStatus('error');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Success state ──────────────────────────────────────────────────────
  if (status === 'success' && result) {
    const isBatch = result.isBatch && result.batches && result.batches.length > 1;

    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 3, textAlign: 'center' }}>
          <Box sx={{
            width: 72, height: 72, borderRadius: '50%',
            background: alpha(COLORS.neonGreen, 0.12),
            border: `2px solid ${alpha(COLORS.neonGreen, 0.5)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CheckCircleIcon sx={{ fontSize: '2rem', color: COLORS.neonGreen }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: COLORS.neonGreen }}>
              {isBatch ? `¡${result.totalBatches} lotes creados!` : '¡Migración creada!'}
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              {isBatch
                ? `${result.totalBatches} migraciones nombradas creadas en SM2 y registradas en el sistema.`
                : 'La migración fue registrada en el sistema y configurada en Mediastream.'}
            </Typography>
          </Box>
        </Box>

        {/* Lotes */}
        {isBatch && result.batches ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {result.batches.map((b) => (
              <Box
                key={b.migrationId}
                sx={{
                  p: 1.5, borderRadius: 2,
                  border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
                  background: alpha(COLORS.darkCard, 0.5),
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Chip
                    label={`Lote ${b.index}/${result.totalBatches}`}
                    size="small"
                    sx={{ height: 20, fontSize: '0.68rem', bgcolor: alpha(COLORS.neonGreen, 0.12), color: COLORS.neonGreen }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {b.rowCount.toLocaleString()} items
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.disabled' }}>
                    {b.migrationId.slice(0, 8)}…
                  </Typography>
                  <Button
                    size="small"
                    href={`/migrations/${b.migrationId}`}
                    endIcon={<OpenInNewIcon sx={{ fontSize: '0.75rem' }} />}
                    sx={{ fontSize: '0.72rem', color: 'text.secondary', minWidth: 0, px: 1 }}
                  >
                    Ver
                  </Button>
                </Box>
              </Box>
            ))}
          </Box>
        ) : (
          /* Migración simple */
          <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`, background: alpha(COLORS.darkCard, 0.5), display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'ID (helpperMigrator)', value: result.migrationId },
              { label: 'ID en Mediastream (SM2)', value: result.mediastreamId },
            ].map(({ label, value }) => (
              <Box key={label}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.disabled">{label}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{value}</Typography>
                    <Button size="small" onClick={() => handleCopy(value)} sx={{ minWidth: 0, p: 0.5, color: 'text.disabled' }}>
                      <CopyIcon sx={{ fontSize: '0.85rem' }} />
                    </Button>
                  </Box>
                </Box>
                <Divider sx={{ borderColor: alpha(COLORS.darkBorder, 0.5), mt: 0.75 }} />
              </Box>
            ))}
            {copied && <Typography variant="caption" sx={{ color: COLORS.neonGreen, textAlign: 'right' }}>✓ Copiado</Typography>}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="contained" href={`/migrations/${result.migrationId}`} endIcon={<OpenInNewIcon />} sx={{ fontWeight: 700, flex: 1 }}>
            {isBatch ? 'Ver lote 1' : 'Ver migración'}
          </Button>
          <Button variant="outlined" href="/migrations" sx={{ color: 'text.secondary', borderColor: alpha(COLORS.darkBorder, 0.8) }}>
            Ir a lista
          </Button>
        </Box>
      </Box>
    );
  }

  // ── Main form ──────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Confirmar y crear migración
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Esta acción creará la configuración de migración en Mediastream (SM2) y registrará
          el proceso en helpperMigrator.
        </Typography>
      </Box>

      {/* Summary box */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
          background: alpha(COLORS.darkCard, 0.5),
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
        }}
      >
        <Typography variant="overline" sx={{ color: 'text.disabled', fontSize: '0.68rem' }}>
          Resumen de la migración
        </Typography>
        <Divider sx={{ borderColor: alpha(COLORS.darkBorder, 0.5) }} />

        {[
          { label: 'Nombre', value: migrationName || '—' },
          {
            label: 'Estrategia',
            value: migrationStrategy === 'transcode' ? 'Transcodificar' : 'Upload directo',
          },
          {
            label: 'Contenido',
            value:
              contentType === 'vod'
                ? 'VOD'
                : contentType === 'aod'
                ? 'AOD'
                : contentType === 'both'
                ? 'VOD + AOD'
                : '—',
          },
          { label: 'Archivo CSV', value: tempFile?.fileName ?? '—' },
          { label: 'Filas', value: tempFile?.rowCount?.toLocaleString() ?? '—' },
          { label: 'Campos mapeados', value: mappings.length },
          {
            label: 'Columnas adicionales',
            value: extraColumns.length > 0 ? extraColumns.map((c) => c.name).join(', ') : 'Ninguna',
          },
          {
            label: 'URLs verificadas',
            value: urlSummary
              ? `${urlSummary.accessible}/${urlSummary.total} accesibles`
              : 'No verificadas',
          },
          { label: 'Publicidad', value: hasAdvertising === null ? '—' : hasAdvertising ? 'Sí' : 'No' },
          {
            label: 'Cuenta',
            value: session?.accountName ?? session?.accountId ?? '—',
          },
          ...(batchConfig.enabled && estimatedBatches ? [
            { label: 'Lotes', value: `${estimatedBatches} × ${batchConfig.size} items (${batchConfig.mode === 'manual' ? 'piloto' : 'automático'})` },
          ] : []),
        ].map(({ label, value }) => (
          <Box
            key={label}
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              py: 0.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right', maxWidth: '55%' }}>
              {value}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Warnings */}
      {urlSummary && urlSummary.failed > 0 && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha('#F5A623', 0.3)}`,
            background: alpha('#F5A623', 0.06),
          }}
        >
          <WarningIcon sx={{ color: '#F5A623', flexShrink: 0 }} />
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: '#F5A623' }}>
              {urlSummary.failed} URL{urlSummary.failed !== 1 ? 's' : ''} inaccesible
              {urlSummary.failed !== 1 ? 's' : ''}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Estos elementos fallarán durante la migración. Puedes continuar o volver a corregirlos.
            </Typography>
          </Box>
        </Box>
      )}

      {/* Error */}
      {status === 'error' && errorMsg && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.5,
            p: 2,
            borderRadius: 2,
            border: `1px solid ${alpha(COLORS.alertRed, 0.3)}`,
            background: alpha(COLORS.alertRed, 0.06),
          }}
        >
          <WarningIcon sx={{ color: COLORS.alertRed, flexShrink: 0 }} />
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.alertRed }}>
              Error al crear la migración
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {errorMsg}
            </Typography>
          </Box>
        </Box>
      )}

      {/* What will happen info */}
      <Box
        sx={{
          p: 2,
          borderRadius: 2,
          border: `1px solid ${alpha(COLORS.neonGreen, 0.2)}`,
          background: alpha(COLORS.neonGreen, 0.04),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <DescriptionIcon sx={{ fontSize: '1rem', color: COLORS.neonGreen }} />
          <Typography variant="caption" fontWeight={600} sx={{ color: COLORS.neonGreen }}>
            ¿Qué ocurre al confirmar?
          </Typography>
        </Box>
        {[
          'Se crea la configuración de migración en Mediastream (SM2)',
          'El CSV normalizado queda vinculado al proceso',
          'El estado inicial es "Validado" — listo para iniciar',
          'Podrás iniciar, pausar y monitorear desde el dashboard',
        ].map((item, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Typography variant="caption" sx={{ color: COLORS.neonGreen, flexShrink: 0 }}>
              {i + 1}.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {item}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* ── Configuración de lotes ── */}
      <Box
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(batchConfig.enabled ? COLORS.neonGreen : COLORS.charcoal, batchConfig.enabled ? 0.3 : 0.5)}`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            px: 2, py: 1.5,
            background: alpha(batchConfig.enabled ? COLORS.neonGreen : COLORS.charcoal, 0.08),
            display: 'flex', alignItems: 'center', gap: 1.5,
          }}
        >
          <BatchIcon sx={{ fontSize: 18, color: batchConfig.enabled ? COLORS.neonGreen : 'text.disabled' }} />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: batchConfig.enabled ? COLORS.neonGreen : 'text.disabled', flexGrow: 1 }}>
            Migración por lotes
          </Typography>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={batchConfig.enabled}
                onChange={(e) => updateBatch({ enabled: e.target.checked, namePrefix: batchConfig.namePrefix || migrationName })}
                sx={{ '& .MuiSwitch-thumb': { bgcolor: batchConfig.enabled ? COLORS.neonGreen : undefined } }}
              />
            }
            label=""
            sx={{ m: 0 }}
          />
        </Box>

        <Collapse in={batchConfig.enabled}>
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="caption" color="text.secondary">
              El CSV se dividirá en lotes. Cada lote se crea como una migración independiente y nombrada en SM2,
              lo que permite validar con un piloto antes de comprometer toda la transcodificación.
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField
                label="Items por lote"
                type="number"
                size="small"
                value={batchConfig.size}
                onChange={(e) => updateBatch({ size: Math.max(1, parseInt(e.target.value) || 500) })}
                inputProps={{ min: 1, style: { fontSize: '0.82rem' } }}
                helperText={
                  estimatedBatches
                    ? `→ ${estimatedBatches} lote${estimatedBatches !== 1 ? 's' : ''} de ${batchConfig.size} items`
                    : 'Filas por migración SM2'
                }
              />
              <TextField
                label="Prefijo de nombre"
                size="small"
                value={batchConfig.namePrefix}
                onChange={(e) => updateBatch({ namePrefix: e.target.value })}
                inputProps={{ style: { fontSize: '0.82rem' } }}
                helperText={`Ej: "${batchConfig.namePrefix || migrationName} - Lote 1/${estimatedBatches ?? 'N'}"`}
              />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              <Typography variant="caption" color="text.secondary">Modo de ejecución</Typography>
              <ToggleButtonGroup
                value={batchConfig.mode}
                exclusive
                onChange={(_, v) => v && updateBatch({ mode: v })}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: `1px solid ${alpha(COLORS.charcoal, 0.7)}`,
                    color: 'text.secondary',
                    px: 2, py: 0.75,
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    gap: 0.15,
                    '&.Mui-selected': {
                      bgcolor: alpha(COLORS.neonGreen, 0.1),
                      borderColor: alpha(COLORS.neonGreen, 0.4),
                      color: COLORS.neonGreen,
                    },
                  },
                }}
              >
                <ToggleButton value="auto">
                  <Typography variant="caption" fontWeight={700}>Automático</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.62rem', opacity: 0.7 }}>Crea todos los lotes de una vez</Typography>
                </ToggleButton>
                <ToggleButton value="manual">
                  <Typography variant="caption" fontWeight={700}>Piloto (manual)</Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.62rem', opacity: 0.7 }}>Confirmar lote a lote</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {estimatedBatches && (
              <Box sx={{ p: 1.5, borderRadius: 1.5, background: alpha(COLORS.neonGreen, 0.06), border: `1px solid ${alpha(COLORS.neonGreen, 0.2)}` }}>
                <Typography variant="caption" sx={{ color: COLORS.neonGreen }}>
                  Se crearán <strong>{estimatedBatches} migraciones</strong> en SM2:
                  &ldquo;{batchConfig.namePrefix || migrationName} - Lote 1/{estimatedBatches}&rdquo; … &ldquo;Lote {estimatedBatches}/{estimatedBatches}&rdquo;
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </Box>

      {/* ── Guardar como template ── */}
      {!templateId && (
        <Box
          sx={{
            borderRadius: 2,
            border: `1px solid ${alpha(saveAsTemplate ? COLORS.sageGreen : COLORS.charcoal, saveAsTemplate ? 0.4 : 0.5)}`,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              px: 2, py: 1.5,
              background: alpha(saveAsTemplate ? COLORS.sageGreen : COLORS.charcoal, 0.08),
              display: 'flex', alignItems: 'center', gap: 1.5,
            }}
          >
            <SaveTemplateIcon sx={{ fontSize: 18, color: saveAsTemplate ? COLORS.sageGreen : 'text.disabled' }} />
            <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', color: saveAsTemplate ? COLORS.sageGreen : 'text.disabled', flexGrow: 1 }}>
              Guardar configuración como template
            </Typography>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={saveAsTemplate}
                  onChange={(e) => {
                    setSaveAsTemplate(e.target.checked);
                    if (e.target.checked && !templateName.trim()) setTemplateName(migrationName || '');
                  }}
                  sx={{ '& .MuiSwitch-thumb': { bgcolor: saveAsTemplate ? COLORS.sageGreen : undefined } }}
                />
              }
              label=""
              sx={{ m: 0 }}
            />
          </Box>
          <Collapse in={saveAsTemplate}>
            <Box sx={{ p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                El mapeo de campos se guardará como template reutilizable. La próxima vez que cargues
                un CSV con headers similares, se detectará automáticamente.
              </Typography>
              <TextField
                label="Nombre del template"
                size="small"
                fullWidth
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                inputProps={{ style: { fontSize: '0.82rem' } }}
                helperText={`${mappings.length} campos mapeados · ${tempFile?.headers?.length ?? 0} headers`}
              />
            </Box>
          </Collapse>
        </Box>
      )}
      {templateId && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1 }}>
          <SaveTemplateIcon sx={{ fontSize: 15, color: COLORS.sageGreen }} />
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
            Se actualizará el contador de uso del template aplicado
          </Typography>
        </Box>
      )}

      {/* Submit button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        {!canSubmit && status === 'idle' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label="Completa los pasos anteriores para continuar"
              size="small"
              sx={{
                background: alpha(COLORS.charcoal, 0.3),
                color: 'text.disabled',
              }}
            />
          </Box>
        )}
        {(['idle', 'submitting', 'error'] as SubmitStatus[]).includes(status) && (
          <Button
            variant="contained"
            size="large"
            onClick={handleSubmit}
            disabled={status === 'submitting' || !canSubmit}
            startIcon={
              status === 'submitting' ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RocketIcon />
              )
            }
            sx={{
              fontWeight: 700,
              px: 4,
              background: `linear-gradient(135deg, ${alpha(COLORS.neonGreen, 0.9)}, ${alpha(COLORS.sageGreen, 0.9)})`,
              color: '#000',
              '&:hover': {
                background: `linear-gradient(135deg, ${COLORS.neonGreen}, ${COLORS.sageGreen})`,
              },
            }}
          >
            {status === 'submitting'
            ? (batchConfig.enabled ? `Creando ${estimatedBatches ?? ''} lotes…` : 'Creando migración…')
            : batchConfig.enabled
            ? `Crear ${estimatedBatches ?? ''} lotes en SM2`
            : 'Crear migración en SM2'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
