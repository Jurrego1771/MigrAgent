import { Box, Typography, Chip, LinearProgress, alpha, Divider } from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  Description as DescriptionIcon,
  Link as LinkIcon,
  Public as PublicIcon,
} from '@mui/icons-material';
import { useWizard } from '../../../context/WizardContext';
import { COLORS } from '../../../theme';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: 'text.disabled', letterSpacing: '0.12em', fontSize: '0.68rem', mb: 1 }}
    >
      {label}
    </Typography>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.75 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        fontWeight={600}
        sx={{ fontFamily: mono ? 'monospace' : undefined, textAlign: 'right', maxWidth: '60%' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
      {ok ? (
        <CheckCircleIcon sx={{ fontSize: '1rem', color: COLORS.neonGreen }} />
      ) : (
        <CancelIcon sx={{ fontSize: '1rem', color: COLORS.alertRed }} />
      )}
      <Typography variant="body2" sx={{ color: ok ? COLORS.neonGreen : COLORS.alertRed }}>
        {label}
      </Typography>
    </Box>
  );
}

function Card({
  children,
  borderColor,
}: {
  children: React.ReactNode;
  borderColor?: string;
}) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: `1px solid ${alpha(borderColor ?? COLORS.darkBorder, borderColor ? 0.35 : 0.8)}`,
        background: alpha(COLORS.darkCard, 0.5),
        display: 'flex',
        flexDirection: 'column',
        gap: 0.25,
      }}
    >
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function ValidationReportStep() {
  const { session, accountValidation, csvStep, urlValidation } = useWizard();

  const { accountInfo, contentType, hasAdvertising, migrationName, migrationStrategy } =
    accountValidation;
  const { tempFile, mappings, extraColumns, normalizedTempId } = csvStep;
  const { summary: urlSummary, checkedAt } = urlValidation;

  // Compute readiness checks
  const checks = {
    auth: session !== null,
    account: !!accountInfo && !!migrationName,
    csv: !!tempFile && mappings.some((m) => m.mapper === 'id'),
    urls: urlSummary !== null,
    urlsHealthy: urlSummary ? urlSummary.failed === 0 : false,
  };

  const requiredPassed = checks.auth && checks.account && checks.csv && checks.urls;
  const allGreen = requiredPassed && checks.urlsHealthy;

  // URL accessibility %
  const urlPct =
    urlSummary && urlSummary.total > 0
      ? Math.round((urlSummary.accessible / urlSummary.total) * 100)
      : null;

  const urlColor =
    urlPct === null
      ? 'text.disabled'
      : urlPct === 100
      ? COLORS.neonGreen
      : urlPct >= 80
      ? COLORS.sageGreen
      : urlPct >= 50
      ? '#F5A623'
      : COLORS.alertRed;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box>
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Informe de validación
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Revisa el resumen de la configuración antes de crear la migración en Mediastream.
        </Typography>
      </Box>

      {/* Go / No-go banner */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2.5,
          borderRadius: 2,
          border: `1px solid ${alpha(allGreen ? COLORS.neonGreen : '#F5A623', 0.35)}`,
          background: alpha(allGreen ? COLORS.neonGreen : '#F5A623', 0.06),
        }}
      >
        {allGreen ? (
          <CheckCircleIcon sx={{ color: COLORS.neonGreen, fontSize: '1.8rem' }} />
        ) : (
          <WarningIcon sx={{ color: '#F5A623', fontSize: '1.8rem' }} />
        )}
        <Box>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ color: allGreen ? COLORS.neonGreen : '#F5A623' }}
          >
            {allGreen ? 'Todo listo para migrar' : 'Hay advertencias — revisa antes de continuar'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {allGreen
              ? 'Todos los checks pasaron correctamente.'
              : 'Puedes continuar, pero algunos elementos requieren atención.'}
          </Typography>
        </Box>
      </Box>

      {/* Checks list */}
      <Card>
        <SectionHeader label="Estado de los pasos" />
        <StatusBadge ok={checks.auth} label={checks.auth ? 'Autenticado en Mediastream' : 'Sin sesión activa'} />
        <StatusBadge
          ok={checks.account}
          label={
            checks.account
              ? `Cuenta verificada — ${migrationName || '(sin nombre)'}`
              : 'Cuenta no configurada'
          }
        />
        <StatusBadge
          ok={checks.csv}
          label={
            checks.csv
              ? `CSV cargado — ${tempFile?.rowCount ?? 0} filas, ${mappings.length} campos mapeados`
              : 'CSV no cargado o sin campos requeridos'
          }
        />
        <StatusBadge
          ok={checks.urls}
          label={
            checks.urls
              ? `URLs verificadas — ${urlPct}% accesibles`
              : 'Verificación de URLs pendiente'
          }
        />
        {checks.urls && !checks.urlsHealthy && urlSummary && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, pl: 3 }}>
            <WarningIcon sx={{ fontSize: '0.9rem', color: '#F5A623' }} />
            <Typography variant="caption" sx={{ color: '#F5A623' }}>
              {urlSummary.failed} URL{urlSummary.failed !== 1 ? 's' : ''} inaccesible
              {urlSummary.failed !== 1 ? 's' : ''} — fallarán durante la migración
            </Typography>
          </Box>
        )}
      </Card>

      {/* Two-column detail */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        {/* Migración */}
        <Card>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PersonIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
            <SectionHeader label="Configuración de migración" />
          </Box>
          <Divider sx={{ mb: 1, borderColor: alpha(COLORS.darkBorder, 0.5) }} />
          <InfoRow label="Nombre" value={migrationName || '—'} />
          <InfoRow
            label="Estrategia"
            value={
              <Chip
                label={migrationStrategy === 'transcode' ? 'Transcodificar' : 'Upload directo'}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.7rem',
                  background: alpha(COLORS.sageGreen, 0.15),
                  color: COLORS.sageGreen,
                }}
              />
            }
          />
          <InfoRow
            label="Tipo de contenido"
            value={
              contentType === 'vod'
                ? 'VOD'
                : contentType === 'aod'
                ? 'AOD'
                : contentType === 'both'
                ? 'VOD + AOD'
                : '—'
            }
          />
          <InfoRow
            label="Publicidad"
            value={hasAdvertising === null ? '—' : hasAdvertising ? 'Sí' : 'No'}
          />
          {session && (
            <InfoRow label="Cuenta" value={session.accountName ?? session.accountId} />
          )}
        </Card>

        {/* CSV */}
        <Card>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <DescriptionIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
            <SectionHeader label="Archivo CSV" />
          </Box>
          <Divider sx={{ mb: 1, borderColor: alpha(COLORS.darkBorder, 0.5) }} />
          <InfoRow label="Archivo" value={tempFile?.fileName ?? '—'} />
          <InfoRow label="Filas" value={tempFile?.rowCount?.toLocaleString() ?? '—'} />
          <InfoRow label="Campos mapeados" value={mappings.length} />
          <InfoRow
            label="Columnas extra"
            value={
              extraColumns.length > 0 ? (
                <Chip
                  label={`+${extraColumns.length}`}
                  size="small"
                  sx={{
                    height: 18,
                    fontSize: '0.7rem',
                    background: alpha(COLORS.neonGreen, 0.12),
                    color: COLORS.neonGreen,
                  }}
                />
              ) : (
                'Ninguna'
              )
            }
          />
          <InfoRow
            label="CSV normalizado"
            value={
              normalizedTempId ? (
                <CheckCircleIcon sx={{ fontSize: '1rem', color: COLORS.neonGreen }} />
              ) : (
                '—'
              )
            }
          />
        </Card>
      </Box>

      {/* URL stats */}
      {urlSummary && (
        <Card borderColor={urlColor as string}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LinkIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
            <SectionHeader label="URLs de medios" />
          </Box>
          <Divider sx={{ mb: 1.5, borderColor: alpha(COLORS.darkBorder, 0.5) }} />
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
            {[
              { label: 'Total', value: urlSummary.total, color: COLORS.sageGreen },
              { label: 'Accesibles', value: urlSummary.accessible, color: COLORS.neonGreen },
              { label: 'Fallidas', value: urlSummary.failed, color: COLORS.alertRed },
              { label: 'Rate limit', value: urlSummary.withRateLimit, color: '#F5A623' },
            ].map(({ label, value, color }) => (
              <Box key={label} sx={{ textAlign: 'center' }}>
                <Typography variant="h6" fontWeight={700} sx={{ color }}>
                  {value}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {label}
                </Typography>
              </Box>
            ))}
          </Box>
          {urlPct !== null && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.disabled">
                  Accesibilidad global
                </Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: urlColor }}>
                  {urlPct}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={urlPct}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: alpha(COLORS.charcoal, 0.4),
                  '& .MuiLinearProgress-bar': {
                    backgroundColor: urlColor as string,
                    borderRadius: 3,
                  },
                }}
              />
            </>
          )}
          {Object.keys(urlSummary.byDomain).length > 0 && (
            <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
              {Object.entries(urlSummary.byDomain)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 6)
                .map(([domain]) => (
                  <Box key={domain} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <PublicIcon sx={{ fontSize: '0.75rem', color: 'text.disabled' }} />
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', color: 'text.secondary' }}
                    >
                      {domain}
                    </Typography>
                  </Box>
                ))}
              {Object.keys(urlSummary.byDomain).length > 6 && (
                <Typography variant="caption" color="text.disabled">
                  +{Object.keys(urlSummary.byDomain).length - 6} más
                </Typography>
              )}
            </Box>
          )}
          {checkedAt && (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: 'block' }}>
              Verificado: {new Date(checkedAt).toLocaleString()}
            </Typography>
          )}
        </Card>
      )}

      {/* Mapped fields summary */}
      {mappings.length > 0 && (
        <Card>
          <SectionHeader label="Campos mapeados" />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
            {mappings.map((m) => (
              <Chip
                key={m.field}
                label={`${m.field} → ${m.mapper}`}
                size="small"
                sx={{
                  height: 22,
                  fontSize: '0.72rem',
                  fontFamily: 'monospace',
                  background: alpha(COLORS.charcoal, 0.4),
                  color: 'text.secondary',
                }}
              />
            ))}
          </Box>
        </Card>
      )}
    </Box>
  );
}
