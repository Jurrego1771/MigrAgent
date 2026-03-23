import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Chip,
  CircularProgress,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  IconButton,
  Tooltip,
  alpha,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Warning as WarningIcon,
  Refresh as RefreshIcon,
  OpenInNew as OpenInNewIcon,
  VideoLibrary as VodIcon,
  Headphones as AodIcon,
  Layers as BothIcon,
  Campaign as AdsIcon,
  AutoAwesome as SuggestIcon,
  Psychology as AIIcon,
} from '@mui/icons-material';
import { accountApi } from '../../../services/api';
import { useWizard } from '../../../context/WizardContext';
import { AIFeatureStatus, RenditionsInfo } from '../../../types';
import { COLORS } from '../../../theme';

// ---------------------------------------------------------------------------
// Sub-componentes de sección
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
  status,
}: {
  title: string;
  children: React.ReactNode;
  status?: 'ok' | 'warn' | 'error' | 'loading' | 'neutral';
}) {
  const borderColor =
    status === 'ok'
      ? alpha(COLORS.sageGreen, 0.5)
      : status === 'warn'
      ? alpha(COLORS.dustyRose, 0.5)
      : status === 'error'
      ? alpha(COLORS.alertRed, 0.4)
      : status === 'loading'
      ? alpha(COLORS.charcoal, 0.5)
      : alpha(COLORS.charcoal, 0.5);

  return (
    <Box
      sx={{
        border: `1px solid ${borderColor}`,
        borderRadius: 3,
        p: 2.5,
        background: alpha(COLORS.darkCard, 0.5),
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          fontSize: '0.65rem',
          fontWeight: 700,
        }}
      >
        {title}
      </Typography>
      {children}
    </Box>
  );
}

function ModuleRow({
  label,
  active,
  required,
  description,
}: {
  label: string;
  active: boolean;
  required?: boolean;
  description?: string;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      {active ? (
        <CheckIcon sx={{ fontSize: 18, color: COLORS.sageGreen, flexShrink: 0 }} />
      ) : required ? (
        <CancelIcon sx={{ fontSize: 18, color: COLORS.alertRed, flexShrink: 0 }} />
      ) : (
        <WarningIcon sx={{ fontSize: 18, color: COLORS.dustyRose, flexShrink: 0 }} />
      )}
      <Box>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: active ? 'text.primary' : required ? COLORS.alertRed : COLORS.dustyRose }}
        >
          {label}
          {required && !active && (
            <Chip
              label="Requerido"
              size="small"
              sx={{ ml: 1, height: 16, fontSize: '0.6rem', bgcolor: alpha(COLORS.alertRed, 0.15), color: COLORS.alertRed }}
            />
          )}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

function buildSuggestedName(accountName: string | null | undefined): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const time = now.toTimeString().slice(0, 5);  // HH:mm
  const base = accountName?.trim() || 'Migración';
  return `${base} - ${date} ${time}`;
}

export default function AccountValidationStep() {
  const { accountValidation, setAccountValidation, session } = useWizard();
  const { accountInfo, renditionsInfo, contentType, hasAdvertising, migrationName, migrationStrategy } =
    accountValidation;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestName = () => {
    setAccountValidation({ migrationName: buildSuggestedName(session?.accountName) });
  };

  const loadAccountData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, renditions] = await Promise.all([
        accountApi.getInfo(),
        accountApi.getRenditions(),
      ]);
      setAccountValidation({ accountInfo: info, renditionsInfo: renditions });
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Error al cargar datos de la cuenta.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Cargar al montar si no hay datos
  useEffect(() => {
    if (!accountInfo) {
      loadAccountData();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-sugerir nombre cuando carga la cuenta por primera vez
  useEffect(() => {
    if (accountInfo && !migrationName.trim()) {
      suggestName();
    }
  }, [accountInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuando el usuario activa publicidad → sugerir campo category
  const handleAdvertisingChange = (value: boolean | null) => {
    setAccountValidation({
      hasAdvertising: value,
      suggestCategoryField: value === true,
    });
  };

  const hasCriticalError =
    accountInfo && (!accountInfo.moduleChecks.media || !accountInfo.moduleChecks.migration);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Configuración de la migración
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Verificamos que tu cuenta tenga los módulos y calidades necesarios antes de comenzar.
            {session && (
              <Typography component="span" variant="body2" sx={{ color: COLORS.neonGreen, ml: 0.5 }}>
                · {session.accountName || session.accountId}
              </Typography>
            )}
          </Typography>
        </Box>
        <Tooltip title="Recargar datos de la cuenta">
          <IconButton size="small" onClick={loadAccountData} disabled={loading} sx={{ color: 'text.disabled' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Error global */}
      {error && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          {error}
        </Alert>
      )}

      {/* Loading skeleton */}
      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 4, justifyContent: 'center' }}>
          <CircularProgress size={24} sx={{ color: COLORS.neonGreen }} />
          <Typography variant="body2" color="text.secondary">
            Consultando cuenta en Mediastream…
          </Typography>
        </Box>
      )}

      {!loading && accountInfo && (
        <>
          {/* Error crítico */}
          {hasCriticalError && (
            <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
              Esta cuenta no tiene los módulos mínimos necesarios para migrar contenido. Contacta al
              administrador de la plataforma.
            </Alert>
          )}

          {/* ── Sección 1: Módulos ── */}
          <SectionCard
            title="Módulos de la cuenta"
            status={hasCriticalError ? 'error' : 'ok'}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
              <ModuleRow
                label="Módulo media"
                active={accountInfo.moduleChecks.media}
                required
                description="Gestión y almacenamiento de contenido multimedia"
              />
              <ModuleRow
                label="Módulo migración"
                active={accountInfo.moduleChecks.migration}
                required
                description="Importación masiva de contenido desde CSV"
              />
              <Divider sx={{ opacity: 0.3, my: 0.5 }} />
              <ModuleRow
                label="VOD (Video On Demand)"
                active={accountInfo.moduleChecks.vod}
                description={
                  accountInfo.moduleChecks.vod
                    ? `Perfiles: ${accountInfo.account.encodingProfiles.join(', ') || 'detectados'}`
                    : 'No se detectaron perfiles de video activos'
                }
              />
              <ModuleRow
                label="AOD (Audio On Demand)"
                active={accountInfo.moduleChecks.aod}
                description="Podcasts y contenido de audio"
              />
              {accountInfo.moduleChecks.advertising && (
                <ModuleRow
                  label="Publicidad configurada"
                  active
                  description="Se detectó configuración de ads en la cuenta"
                />
              )}
              {accountInfo.moduleChecks.drm && (
                <ModuleRow label="DRM" active description="Protección de contenido digital" />
              )}
            </Box>
          </SectionCard>

          {/* ── Sección 2: Tipo de contenido ── */}
          <SectionCard
            title="Tipo de contenido a migrar"
            status={contentType ? 'ok' : 'neutral'}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                ¿Qué tipo de contenido vas a migrar?
              </Typography>
              <ToggleButtonGroup
                value={contentType}
                exclusive
                onChange={(_, v) => v && setAccountValidation({ contentType: v })}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: `1px solid ${alpha(COLORS.charcoal, 0.7)}`,
                    color: 'text.secondary',
                    gap: 1,
                    px: 2,
                    py: 1,
                    '&.Mui-selected': {
                      bgcolor: alpha(COLORS.neonGreen, 0.12),
                      borderColor: alpha(COLORS.neonGreen, 0.5),
                      color: COLORS.neonGreen,
                      fontWeight: 700,
                    },
                  },
                }}
              >
                <ToggleButton value="vod" disabled={!accountInfo.moduleChecks.vod}>
                  <VodIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption" fontWeight={600}>VOD</Typography>
                </ToggleButton>
                <ToggleButton value="aod" disabled={!accountInfo.moduleChecks.aod}>
                  <AodIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption" fontWeight={600}>AOD</Typography>
                </ToggleButton>
                <ToggleButton
                  value="both"
                  disabled={!accountInfo.moduleChecks.vod || !accountInfo.moduleChecks.aod}
                >
                  <BothIcon sx={{ fontSize: 16 }} />
                  <Typography variant="caption" fontWeight={600}>Ambos</Typography>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </SectionCard>

          {/* ── Sección 3: Publicidad ── */}
          <SectionCard
            title="Integración de publicidad"
            status={hasAdvertising === null ? 'neutral' : 'ok'}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                ¿El contenido migrado tendrá publicidad asignada?
              </Typography>
              <ToggleButtonGroup
                value={hasAdvertising}
                exclusive
                onChange={(_, v) => v !== null && handleAdvertisingChange(v)}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    border: `1px solid ${alpha(COLORS.charcoal, 0.7)}`,
                    color: 'text.secondary',
                    px: 3,
                    py: 0.75,
                    '&.Mui-selected': {
                      bgcolor: alpha(COLORS.neonGreen, 0.12),
                      borderColor: alpha(COLORS.neonGreen, 0.5),
                      color: COLORS.neonGreen,
                      fontWeight: 700,
                    },
                  },
                }}
              >
                <ToggleButton value={true}>
                  <AdsIcon sx={{ fontSize: 15, mr: 0.5 }} />
                  <Typography variant="caption" fontWeight={600}>Sí</Typography>
                </ToggleButton>
                <ToggleButton value={false}>
                  <Typography variant="caption" fontWeight={600}>No</Typography>
                </ToggleButton>
              </ToggleButtonGroup>

              <Collapse in={hasAdvertising === true}>
                <Alert
                  severity="info"
                  icon={<AdsIcon fontSize="small" />}
                  sx={{ fontSize: '0.8rem', mt: 0.5 }}
                >
                  <strong>Recomendación:</strong> Se agregará un campo <code>category</code> al mapeo del CSV.
                  Esto permite asignar publicidad masivamente a través de categorías en Mediastream.
                </Alert>
              </Collapse>
            </Box>
          </SectionCard>

          {/* ── Sección 4: Renditions ── */}
          {renditionsInfo && (
            <RenditionsSection renditionsInfo={renditionsInfo} contentType={contentType} />
          )}

          {/* ── Sección 5: IA de SM2 ── */}
          {accountInfo.aiSettings && (
            <AISettingsSection aiSettings={accountInfo.aiSettings} />
          )}
        </>
      )}

      {/* ── Sección 5: Datos básicos (siempre visible) ── */}
      <SectionCard title="Datos de la migración" status="neutral">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              label="Nombre de la migración"
              value={migrationName}
              onChange={(e) => setAccountValidation({ migrationName: e.target.value })}
              fullWidth
              size="small"
              placeholder="Ej: Migración VOD - Canal Principal Q1 2026"
              helperText="Nombre único — se usará como prefijo en los lotes SM2"
              error={migrationName.trim().length > 0 && migrationName.trim().length < 3}
            />
            <Tooltip title="Generar nombre con cuenta y fecha actual">
              <IconButton
                size="small"
                onClick={suggestName}
                sx={{ mt: 0.5, color: 'text.disabled', flexShrink: 0 }}
              >
                <SuggestIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
              Estrategia de migración
            </Typography>
            <ToggleButtonGroup
              value={migrationStrategy}
              exclusive
              onChange={(_, v) => v && setAccountValidation({ migrationStrategy: v })}
              size="small"
              sx={{
                '& .MuiToggleButton-root': {
                  border: `1px solid ${alpha(COLORS.charcoal, 0.7)}`,
                  color: 'text.secondary',
                  px: 2.5,
                  py: 0.75,
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 0.25,
                  '&.Mui-selected': {
                    bgcolor: alpha(COLORS.neonGreen, 0.1),
                    borderColor: alpha(COLORS.neonGreen, 0.4),
                    color: COLORS.neonGreen,
                  },
                },
              }}
            >
              <ToggleButton value="transcode">
                <Typography variant="caption" fontWeight={700}>Transcodificar</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'inherit', opacity: 0.7 }}>
                  SM2 procesa el archivo original
                </Typography>
              </ToggleButton>
              <ToggleButton value="upload">
                <Typography variant="caption" fontWeight={700}>Subir rendiciones</Typography>
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'inherit', opacity: 0.7 }}>
                  Archivos ya transcodificados
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
      </SectionCard>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente de IA de SM2
// ---------------------------------------------------------------------------

const AI_FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  transcription: { label: 'Transcripción automática', description: 'Genera subtítulos y texto a partir del audio' },
  metadata:      { label: 'Metadata inteligente',     description: 'Título, descripción y tags generados por IA' },
  chapters:      { label: 'Capítulos',                description: 'Divide el contenido en capítulos automáticamente' },
  highlights:    { label: 'Highlights',               description: 'Detecta los momentos más relevantes del video' },
  article:       { label: 'Artículo',                 description: 'Genera un artículo de blog a partir del contenido' },
  i18n:          { label: 'Traducción (i18n)',        description: 'Traduce transcripción y metadata a otros idiomas' },
  thumbnails:    { label: 'Thumbnails automáticos',   description: 'Genera miniaturas a partir de frames del video' },
};

function AISettingsSection({ aiSettings }: { aiSettings: Record<string, AIFeatureStatus> }) {
  // Solo mostramos features con generación automática activada
  const autoFeatures = Object.entries(AI_FEATURE_LABELS).filter(
    ([key]) => aiSettings[key]?.automatic === true
  );
  const hasAny = autoFeatures.length > 0;

  return (
    <SectionCard
      title="IA de SM2 — Generación automática de metadata"
      status={hasAny ? 'ok' : 'neutral'}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {hasAny ? (
          <>
            <Alert
              severity="info"
              icon={<AIIcon fontSize="small" />}
              sx={{ fontSize: '0.8rem' }}
            >
              <strong>SM2 generará automáticamente</strong> la siguiente metadata después de que cada video termine de transcodificar.
              No se requiere ninguna acción adicional.
            </Alert>

            {autoFeatures.map(([key, meta]) => {
              const status = aiSettings[key];
              return (
                <Box key={key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <CheckIcon sx={{ fontSize: 16, color: COLORS.sageGreen, flexShrink: 0, mt: 0.2 }} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {meta.label}
                      </Typography>
                      {status?.model && (
                        <Chip
                          label={status.model}
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            bgcolor: alpha(COLORS.charcoal, 0.4),
                            color: 'text.disabled',
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
                      {meta.description}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.85rem' }}>
            No se detectaron features de IA con generación automática en esta cuenta.
          </Typography>
        )}
      </Box>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Sub-componente de renditions
// ---------------------------------------------------------------------------

/** Chips de perfiles: verde = activo, gris = inactivo */
function ProfileGrid({ active, missing }: { active: string[]; missing: string[] }) {
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
      {active.map((p) => (
        <Chip
          key={p}
          label={p}
          size="small"
          icon={<CheckIcon style={{ fontSize: 12, color: COLORS.sageGreen }} />}
          sx={{
            bgcolor: alpha(COLORS.sageGreen, 0.13),
            color: COLORS.sageGreen,
            border: `1px solid ${alpha(COLORS.sageGreen, 0.4)}`,
            fontWeight: 600,
            fontSize: '0.72rem',
          }}
        />
      ))}
      {missing.map((p) => (
        <Chip
          key={p}
          label={p}
          size="small"
          variant="outlined"
          sx={{
            borderColor: alpha(COLORS.charcoal, 0.5),
            color: 'text.disabled',
            fontSize: '0.72rem',
          }}
        />
      ))}
    </Box>
  );
}

function RenditionsSection({
  renditionsInfo,
  contentType,
}: {
  renditionsInfo: RenditionsInfo;
  contentType: string | null;
}) {
  const apiUrl = 'https://platform.mediastre.am';
  const {
    activeVideoProfiles, missingVideoProfiles,
    activeVideo9x16Profiles, missingVideo9x16Profiles,
    activeAudioProfiles, missingAudioProfiles,
  } = renditionsInfo;

  const showVideo = contentType !== 'aod';
  const showAudio = contentType !== 'vod';
  const hasEnoughVideoProfiles = activeVideoProfiles.length >= 2;

  return (
    <SectionCard
      title="Calidades configuradas en la cuenta"
      status={showVideo && !hasEnoughVideoProfiles ? 'warn' : 'ok'}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>

        {/* ── Video 16:9 ── */}
        {showVideo && (
          <Box>
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75, fontWeight: 600, letterSpacing: '0.06em' }}>
              VIDEO 16:9
            </Typography>
            {activeVideoProfiles.length === 0 && missingVideoProfiles.length === 0 ? (
              <Alert severity="error" sx={{ fontSize: '0.8rem' }}>
                No se encontraron perfiles de video 16:9.
              </Alert>
            ) : (
              <ProfileGrid active={activeVideoProfiles} missing={missingVideoProfiles} />
            )}
          </Box>
        )}

        {/* ── Video 9:16 ── */}
        {showVideo && (
          <>
            <Divider sx={{ opacity: 0.2 }} />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75, fontWeight: 600, letterSpacing: '0.06em' }}>
                VIDEO 9:16 (VERTICAL)
              </Typography>
              <ProfileGrid active={activeVideo9x16Profiles} missing={missingVideo9x16Profiles} />
            </Box>
          </>
        )}

        {/* ── Audio ── */}
        {showAudio && (
          <>
            <Divider sx={{ opacity: 0.2 }} />
            <Box>
              <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75, fontWeight: 600, letterSpacing: '0.06em' }}>
                AUDIO
              </Typography>
              <ProfileGrid active={activeAudioProfiles} missing={missingAudioProfiles} />
            </Box>
          </>
        )}

        {/* Advertencia video insuficiente */}
        {showVideo && !hasEnoughVideoProfiles && (
          <Alert
            severity="warning"
            sx={{ fontSize: '0.8rem' }}
            action={
              <IconButton
                size="small"
                onClick={() => window.open(`${apiUrl}/settings/media`, '_blank')}
                sx={{ color: 'inherit' }}
              >
                <OpenInNewIcon fontSize="small" />
              </IconButton>
            }
          >
            Se recomienda al menos 2 perfiles de video activos para una migración robusta.
            Configúralos en <strong>Settings → Media</strong> de la plataforma.
          </Alert>
        )}

      </Box>
    </SectionCard>
  );
}
