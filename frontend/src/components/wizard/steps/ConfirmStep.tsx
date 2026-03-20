import { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Chip,
  alpha,
  CircularProgress,
  Divider,
} from '@mui/material';
import {
  RocketLaunch as RocketIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
  OpenInNew as OpenInNewIcon,
  Description as DescriptionIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material';
import { useWizard } from '../../../context/WizardContext';
import { wizardApi } from '../../../services/api';
import { COLORS } from '../../../theme';

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error';

export default function ConfirmStep() {
  const { session, accountValidation, csvStep, urlValidation, markStepComplete, currentStep } =
    useWizard();

  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [result, setResult] = useState<{ migrationId: string; mediastreamId: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { migrationName, migrationStrategy, contentType, hasAdvertising } = accountValidation;
  const { tempFile, mappings, extraColumns, normalizedTempId } = csvStep;
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
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            py: 4,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: alpha(COLORS.neonGreen, 0.12),
              border: `2px solid ${alpha(COLORS.neonGreen, 0.5)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CheckCircleIcon sx={{ fontSize: '2rem', color: COLORS.neonGreen }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} sx={{ color: COLORS.neonGreen }}>
              ¡Migración creada!
            </Typography>
            <Typography variant="body2" color="text.secondary" mt={0.5}>
              La migración fue registrada en el sistema y configurada en Mediastream.
            </Typography>
          </Box>
        </Box>

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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              ID de migración (helpperMigrator)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {result.migrationId}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopy(result.migrationId)}
                sx={{ minWidth: 0, p: 0.5, color: 'text.disabled' }}
              >
                <CopyIcon sx={{ fontSize: '0.85rem' }} />
              </Button>
            </Box>
          </Box>
          <Divider sx={{ borderColor: alpha(COLORS.darkBorder, 0.5) }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="caption" color="text.disabled">
              ID en Mediastream (SM2)
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                {result.mediastreamId}
              </Typography>
              <Button
                size="small"
                onClick={() => handleCopy(result.mediastreamId)}
                sx={{ minWidth: 0, p: 0.5, color: 'text.disabled' }}
              >
                <CopyIcon sx={{ fontSize: '0.85rem' }} />
              </Button>
            </Box>
          </Box>
          {copied && (
            <Typography variant="caption" sx={{ color: COLORS.neonGreen, textAlign: 'right' }}>
              ✓ Copiado
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            variant="contained"
            href={`/migrations/${result.migrationId}`}
            endIcon={<OpenInNewIcon />}
            sx={{ fontWeight: 700, flex: 1 }}
          >
            Ver migración
          </Button>
          <Button
            variant="outlined"
            href="/migrations"
            sx={{ color: 'text.secondary', borderColor: alpha(COLORS.darkBorder, 0.8) }}
          >
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
            {status === 'submitting' ? 'Creando migración…' : 'Crear migración en SM2'}
          </Button>
        )}
      </Box>
    </Box>
  );
}
