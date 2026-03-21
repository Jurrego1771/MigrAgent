import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Chip,
  alpha,
  Collapse,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Refresh as RefreshIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  LinkOff as LinkOffIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { useWizard } from '../../../context/WizardContext';
import { csvApi } from '../../../services/api';
import { COLORS } from '../../../theme';
import { URLCheckResult } from '../../../types';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.5,
        p: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(color, 0.3)}`,
        background: alpha(color, 0.06),
        minWidth: 110,
        flex: 1,
      }}
    >
      <Box sx={{ color, display: 'flex' }}>{icon}</Box>
      <Typography variant="h5" fontWeight={700} sx={{ color }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.disabled" textAlign="center">
        {label}
      </Typography>
    </Box>
  );
}

function DomainRow({
  domain,
  total,
  accessible,
  rateLimited,
}: {
  domain: string;
  total: number;
  accessible: number;
  rateLimited: number;
}) {
  const pct = total > 0 ? Math.round((accessible / total) * 100) : 0;
  const color =
    pct === 100
      ? COLORS.neonGreen
      : pct >= 70
      ? COLORS.sageGreen
      : pct >= 40
      ? '#F5A623'
      : COLORS.alertRed;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        py: 1,
        borderBottom: `1px solid ${alpha(COLORS.darkBorder, 0.5)}`,
      }}
    >
      <PublicIcon sx={{ fontSize: '1rem', color: 'text.disabled', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem' }}>
        {domain}
      </Typography>
      <Box sx={{ width: 100, flexShrink: 0 }}>
        <LinearProgress
          variant="determinate"
          value={pct}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: alpha(COLORS.charcoal, 0.4),
            '& .MuiLinearProgress-bar': { backgroundColor: color, borderRadius: 3 },
          }}
        />
      </Box>
      <Typography variant="caption" sx={{ color, minWidth: 40, textAlign: 'right' }}>
        {pct}%
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ minWidth: 60, textAlign: 'right' }}>
        {accessible}/{total}
      </Typography>
      {rateLimited > 0 && (
        <Tooltip title={`${rateLimited} URLs con rate limit`}>
          <Chip
            label={`RL: ${rateLimited}`}
            size="small"
            sx={{
              height: 18,
              fontSize: '0.65rem',
              background: alpha('#F5A623', 0.15),
              color: '#F5A623',
              border: `1px solid ${alpha('#F5A623', 0.3)}`,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
}

function FailedUrlsSection({ results }: { results: URLCheckResult[] }) {
  const [open, setOpen] = useState(false);
  const failed = results.filter((r) => !r.accessible);
  if (failed.length === 0) return null;

  return (
    <Box
      sx={{
        mt: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(COLORS.alertRed, 0.25)}`,
        overflow: 'hidden',
      }}
    >
      <Box
        onClick={() => setOpen((p) => !p)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          background: alpha(COLORS.alertRed, 0.06),
          '&:hover': { background: alpha(COLORS.alertRed, 0.1) },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinkOffIcon sx={{ fontSize: '1rem', color: COLORS.alertRed }} />
          <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.alertRed }}>
            {failed.length} URL{failed.length !== 1 ? 's' : ''} inaccesible{failed.length !== 1 ? 's' : ''}
          </Typography>
        </Box>
        {open ? (
          <ExpandLessIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
        ) : (
          <ExpandMoreIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
        )}
      </Box>
      <Collapse in={open}>
        <Box sx={{ maxHeight: 200, overflowY: 'auto', px: 2, py: 1 }}>
          {failed.map((r) => (
            <Box
              key={r.url}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                py: 0.75,
                borderBottom: `1px solid ${alpha(COLORS.darkBorder, 0.3)}`,
              }}
            >
              <CancelIcon sx={{ fontSize: '0.85rem', color: COLORS.alertRed, mt: 0.2, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontFamily: 'monospace',
                    wordBreak: 'break-all',
                    color: 'text.secondary',
                    display: 'block',
                  }}
                >
                  {r.url}
                </Typography>
                {r.error && (
                  <Typography variant="caption" color="text.disabled">
                    {r.error}
                  </Typography>
                )}
              </Box>
              {r.statusCode && (
                <Chip
                  label={r.statusCode}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    flexShrink: 0,
                    background: alpha(COLORS.alertRed, 0.15),
                    color: COLORS.alertRed,
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const SAMPLE_OPTIONS = [
  { label: '5%', value: 5, desc: 'Verificación rápida de estructura' },
  { label: '20%', value: 20, desc: 'Chequeo general' },
  { label: '50%', value: 50, desc: 'Revisión exhaustiva' },
  { label: '100%', value: 100, desc: 'Validación completa' },
];

export default function URLValidationStep() {
  const { csvStep, urlValidation, setUrlValidation } = useWizard();
  const [concurrency, setConcurrency] = useState(8);
  const [samplePercent, setSamplePercent] = useState(100);

  const tempId = csvStep.normalizedTempId ?? csvStep.tempFile?.tempId ?? null;

  const handleStartCheck = useCallback(async () => {
    if (!tempId) return;

    setUrlValidation({ status: 'checking', summary: null, results: [], checkedAt: null });

    try {
      const { results, summary } = await csvApi.validateUrls(
        tempId,
        csvStep.mappings,
        concurrency,
        samplePercent
      );
      setUrlValidation({
        status: 'done',
        summary,
        results,
        checkedAt: new Date().toISOString(),
      });
    } catch (err) {
      setUrlValidation({ status: 'idle' });
      console.error('URL validation failed:', err);
    }
  }, [tempId, csvStep.mappings, concurrency, samplePercent, setUrlValidation]);

  const { status, summary, results } = urlValidation;

  // ── Idle / no file ──────────────────────────────────────────────────────
  if (!tempId) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Typography color="text.disabled">
          Completa el paso de CSV antes de validar URLs.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Validar URLs de medios
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Verificamos que cada URL de tu CSV sea accesible antes de iniciar la migración.
          Detectamos errores 4xx/5xx, rate limits y dominos con problemas.
        </Typography>
      </Box>

      {/* Config row */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          p: 2,
          borderRadius: 2,
          border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
          background: alpha(COLORS.darkCard, 0.5),
          flexWrap: 'wrap',
        }}
      >
        {/* Muestra a validar */}
        <Box>
          <Typography variant="caption" color="text.disabled" display="block">
            Muestra a validar
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            {SAMPLE_OPTIONS.map((opt) => (
              <Tooltip key={opt.value} title={opt.desc} placement="top">
                <Chip
                  label={opt.label}
                  size="small"
                  onClick={() => setSamplePercent(opt.value)}
                  sx={{
                    cursor: 'pointer',
                    background:
                      samplePercent === opt.value ? alpha(COLORS.neonGreen, 0.15) : alpha(COLORS.charcoal, 0.3),
                    color: samplePercent === opt.value ? COLORS.neonGreen : 'text.secondary',
                    border: `1px solid ${samplePercent === opt.value ? alpha(COLORS.neonGreen, 0.4) : 'transparent'}`,
                    fontWeight: samplePercent === opt.value ? 700 : 400,
                  }}
                />
              </Tooltip>
            ))}
          </Box>
        </Box>

        <SpeedIcon sx={{ color: 'text.disabled' }} />
        <Box>
          <Typography variant="caption" color="text.disabled" display="block">
            Concurrencia (requests simultáneos)
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            {[4, 8, 12, 20].map((n) => (
              <Chip
                key={n}
                label={n}
                size="small"
                onClick={() => setConcurrency(n)}
                sx={{
                  cursor: 'pointer',
                  background:
                    concurrency === n ? alpha(COLORS.neonGreen, 0.15) : alpha(COLORS.charcoal, 0.3),
                  color: concurrency === n ? COLORS.neonGreen : 'text.secondary',
                  border: `1px solid ${concurrency === n ? alpha(COLORS.neonGreen, 0.4) : 'transparent'}`,
                  fontWeight: concurrency === n ? 700 : 400,
                }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ ml: 'auto' }}>
          {status === 'idle' && (
            <Button
              variant="contained"
              onClick={handleStartCheck}
              sx={{ fontWeight: 700 }}
            >
              Iniciar verificación
            </Button>
          )}
          {status === 'checking' && (
            <Button variant="outlined" disabled startIcon={<CircularProgress size={14} />}>
              Verificando…
            </Button>
          )}
          {status === 'done' && (
            <Button
              variant="outlined"
              onClick={handleStartCheck}
              startIcon={<RefreshIcon />}
              sx={{ color: 'text.secondary', borderColor: alpha(COLORS.darkBorder, 0.8) }}
            >
              Re-verificar
            </Button>
          )}
        </Box>
      </Box>

      {/* Checking state */}
      {status === 'checking' && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress size={48} sx={{ color: COLORS.neonGreen, mb: 2 }} />
          <Typography color="text.secondary">
            Verificando accesibilidad de URLs…
          </Typography>
          <Typography variant="caption" color="text.disabled" display="block" mt={0.5}>
            Esto puede tardar varios minutos dependiendo de la cantidad de URLs
          </Typography>
          <LinearProgress
            sx={{
              mt: 3,
              mx: 'auto',
              maxWidth: 400,
              borderRadius: 2,
              backgroundColor: alpha(COLORS.charcoal, 0.4),
              '& .MuiLinearProgress-bar': { backgroundColor: COLORS.neonGreen },
            }}
          />
        </Box>
      )}

      {/* Results */}
      {status === 'done' && summary && (
        <>
          {/* Indicador de muestra */}
          {summary.samplePercent < 100 && (
            <Box
              sx={{
                px: 2, py: 1, borderRadius: 2,
                background: alpha('#F5A623', 0.08),
                border: `1px solid ${alpha('#F5A623', 0.3)}`,
                display: 'flex', alignItems: 'center', gap: 1,
              }}
            >
              <WarningIcon sx={{ color: '#F5A623', fontSize: 18 }} />
              <Typography variant="caption" color="#F5A623">
                Muestra del <strong>{summary.samplePercent}%</strong> — se verificaron{' '}
                <strong>{summary.total}</strong> de <strong>{summary.sampledFrom}</strong> URLs totales.
                Los resultados son representativos, no absolutos.
              </Typography>
            </Box>
          )}

          {/* Summary cards */}
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            <StatCard
              icon={<CheckCircleIcon />}
              label="Accesibles"
              value={summary.accessible}
              color={COLORS.neonGreen}
            />
            <StatCard
              icon={<CancelIcon />}
              label="Fallidas"
              value={summary.failed}
              color={summary.failed > 0 ? COLORS.alertRed : 'text.disabled' as string}
            />
            <StatCard
              icon={<WarningIcon />}
              label="Rate limit"
              value={summary.withRateLimit}
              color={summary.withRateLimit > 0 ? '#F5A623' : 'text.disabled' as string}
            />
            <StatCard
              icon={<PublicIcon />}
              label="Total"
              value={summary.total}
              color={COLORS.sageGreen}
            />
          </Box>

          {/* Global progress bar */}
          {summary.total > 0 && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.disabled">
                  Tasa de accesibilidad
                </Typography>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  sx={{
                    color:
                      summary.accessible / summary.total >= 0.95
                        ? COLORS.neonGreen
                        : summary.accessible / summary.total >= 0.7
                        ? '#F5A623'
                        : COLORS.alertRed,
                  }}
                >
                  {Math.round((summary.accessible / summary.total) * 100)}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(summary.accessible / summary.total) * 100}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: alpha(COLORS.charcoal, 0.4),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor:
                      summary.accessible / summary.total >= 0.95
                        ? COLORS.neonGreen
                        : summary.accessible / summary.total >= 0.7
                        ? '#F5A623'
                        : COLORS.alertRed,
                    borderRadius: 4,
                  },
                }}
              />
            </Box>
          )}

          {/* Domain breakdown */}
          {Object.keys(summary.byDomain).length > 0 && (
            <Box
              sx={{
                borderRadius: 2,
                border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1.5,
                  background: alpha(COLORS.darkCard, 0.8),
                  borderBottom: `1px solid ${alpha(COLORS.darkBorder, 0.5)}`,
                }}
              >
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Análisis por dominio
                </Typography>
              </Box>
              <Box sx={{ px: 2, py: 0.5, maxHeight: 220, overflowY: 'auto' }}>
                {Object.entries(summary.byDomain)
                  .sort((a, b) => b[1].total - a[1].total)
                  .map(([domain, stats]) => (
                    <DomainRow key={domain} domain={domain} {...stats} />
                  ))}
              </Box>
            </Box>
          )}

          {/* Rate limit warning */}
          {summary.withRateLimit > 0 && (
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
              <WarningIcon sx={{ color: '#F5A623', fontSize: '1.1rem', mt: 0.1, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: '#F5A623' }}>
                  Rate limiting detectado
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.withRateLimit} URL{summary.withRateLimit !== 1 ? 's' : ''} con encabezados de rate
                  limit. La migración puede ser más lenta de lo esperado para estos dominios. Considera reducir
                  la concurrencia o negociar un límite mayor con el proveedor.
                </Typography>
              </Box>
            </Box>
          )}

          {/* Failed URLs */}
          <FailedUrlsSection results={results} />

          {/* OK banner */}
          {summary.failed === 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${alpha(COLORS.neonGreen, 0.3)}`,
                background: alpha(COLORS.neonGreen, 0.05),
              }}
            >
              <CheckCircleIcon sx={{ color: COLORS.neonGreen }} />
              <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.neonGreen }}>
                Todas las URLs son accesibles — listo para continuar.
              </Typography>
            </Box>
          )}

          {summary.failed > 0 && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 1.5,
                p: 2,
                borderRadius: 2,
                border: `1px solid ${alpha(COLORS.alertRed, 0.3)}`,
                background: alpha(COLORS.alertRed, 0.05),
              }}
            >
              <WarningIcon sx={{ color: COLORS.alertRed, flexShrink: 0 }} />
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ color: COLORS.alertRed }}>
                  {summary.failed} URL{summary.failed !== 1 ? 's' : ''} inaccesible
                  {summary.failed !== 1 ? 's' : ''}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Puedes continuar de todas formas, pero estos items fallarán durante la migración.
                  Considera corregir las URLs antes de proceder.
                </Typography>
              </Box>
            </Box>
          )}
        </>
      )}
    </Box>
  );
}
