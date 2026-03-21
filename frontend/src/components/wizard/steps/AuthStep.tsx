import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  alpha,
  Collapse,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon,
  ContentPaste as PasteIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { authApi } from '../../../services/api';
import { useWizard } from '../../../context/WizardContext';
import { SessionInfo } from '../../../types';
import { COLORS } from '../../../theme';

// ---------------------------------------------------------------------------
// Formulario de import de credenciales
// ---------------------------------------------------------------------------

interface ImportForm {
  apiUrl: string;
  jwt: string;
  sid: string;
}

export default function AuthStep() {
  const { session, setSession } = useWizard();

  const [form, setForm] = useState<ImportForm>({
    apiUrl: 'https://dev.platform.mediastre.am',
    jwt: '',
    sid: '',
  });

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);

  // Al montar, verificar si ya hay sesión activa
  useEffect(() => {
    authApi.getSession()
      .then((result) => {
        if (result.authenticated && result.session) setSession(result.session);
      })
      .catch(() => {})
      .finally(() => setSessionChecked(true));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field: keyof ImportForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.jwt.trim() || !form.sid.trim()) {
      setError('JWT y mdstrm.id son requeridos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await authApi.importCredentials({
        jwt: form.jwt.trim(),
        sid: form.sid.trim(),
        apiUrl: form.apiUrl.trim(),
      });
      setSession(result.session);
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al importar credenciales.');
    } finally {
      setLoading(false);
    }
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      const result = await authApi.validate();
      if (!result.valid) {
        setSession(null);
        setError(result.reason || 'La sesión ya no es válida. Importa nuevamente.');
      }
    } catch {
      setError('No se pudo verificar la sesión.');
    } finally {
      setValidating(false);
    }
  };

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignorar */ }
    setSession(null);
    setError(null);
    setForm((p) => ({ ...p, jwt: '', sid: '' }));
  };

  if (!sessionChecked) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: COLORS.neonGreen }} />
      </Box>
    );
  }

  if (session) {
    return (
      <ActiveSessionView
        session={session}
        onLogout={handleLogout}
        onValidate={handleValidate}
        validating={validating}
      />
    );
  }

  return (
    <Box component="form" onSubmit={handleImport} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Header */}
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Conectar con Mediastream
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Pega el JWT y el mdstrm.id desde las DevTools de tu browser mientras tienes sesión abierta en Mediastream.
        </Typography>
      </Box>

      {/* Instrucciones desplegables */}
      <Box
        sx={{
          borderRadius: 2,
          border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
          overflow: 'hidden',
        }}
      >
        <Box
          onClick={() => setInstructionsOpen((p) => !p)}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1.5,
            cursor: 'pointer',
            background: alpha(COLORS.charcoal, 0.2),
            '&:hover': { background: alpha(COLORS.charcoal, 0.35) },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <PasteIcon sx={{ fontSize: '1rem', color: COLORS.neonGreen }} />
            <Typography variant="body2" fontWeight={600}>
              ¿Cómo obtener el JWT y el mdstrm.id?
            </Typography>
          </Box>
          {instructionsOpen
            ? <ExpandLessIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
            : <ExpandMoreIcon sx={{ fontSize: '1rem', color: 'text.disabled' }} />
          }
        </Box>

        <Collapse in={instructionsOpen}>
          <Box sx={{ px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

            {/* Paso 1 */}
            <StepInstruction number={1}>
              Abre Mediastream en tu browser e inicia sesión normalmente.
              <Button
                size="small"
                endIcon={<OpenInNewIcon sx={{ fontSize: '0.8rem' }} />}
                href={form.apiUrl}
                target="_blank"
                sx={{ ml: 1, fontSize: '0.75rem', py: 0.25, color: COLORS.neonGreen }}
              >
                Abrir plataforma
              </Button>
            </StepInstruction>

            {/* Paso 2 */}
            <StepInstruction number={2}>
              Abre DevTools con <Code>F12</Code> y ve a la pestaña <Code>Application</Code> (Chrome) o <Code>Storage</Code> (Firefox).
            </StepInstruction>

            {/* Paso 3 */}
            <StepInstruction number={3}>
              En el panel izquierdo, expande <Code>Cookies</Code> → selecciona el dominio de la plataforma.
            </StepInstruction>

            {/* Paso 4 */}
            <StepInstruction number={4}>
              Copia el valor de la cookie <Code>jwt</Code> y pégalo en el campo <strong>JWT Token</strong> abajo.
            </StepInstruction>

            {/* Paso 5 */}
            <StepInstruction number={5}>
              Copia el valor de la cookie <Code>mdstrm.id</Code> y pégalo en el campo <strong>Connect.sid</strong> abajo. Incluye el prefijo <Code>s%3A</Code> si aparece.
            </StepInstruction>

            <Alert severity="info" sx={{ fontSize: '0.78rem', mt: 0.5 }}>
              Alternativamente, en la consola del browser ejecuta:<br />
              <code style={{ fontSize: '0.75rem' }}>
                document.cookie.split(';').map(c =&gt; c.trim())
              </code>
            </Alert>
          </Box>
        </Collapse>
      </Box>

      {/* URL de la plataforma */}
      <TextField
        label="URL de la plataforma"
        value={form.apiUrl}
        onChange={handleChange('apiUrl')}
        fullWidth
        size="small"
        InputProps={{
          startAdornment: (
            <Box sx={{ mr: 1, display: 'flex' }}>
              <LinkIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </Box>
          ),
        }}
        helperText="URL base de tu instancia de Mediastream (sin trailing slash)"
      />

      <Divider />

      {/* JWT */}
      <TextField
        label="JWT Token"
        value={form.jwt}
        onChange={handleChange('jwt')}
        fullWidth
        multiline
        minRows={3}
        maxRows={5}
        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJp..."
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem' } }}
        helperText="Valor de la cookie 'jwt' en DevTools → Application → Cookies"
      />

      {/* mdstrm.id */}
      <TextField
        label="mdstrm.id"
        value={form.sid}
        onChange={handleChange('sid')}
        fullWidth
        placeholder="s%3AxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
        inputProps={{ style: { fontFamily: 'monospace', fontSize: '0.78rem' } }}
        helperText="Valor de la cookie 'mdstrm.id' en DevTools → Application → Cookies"
      />

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          {error}
        </Alert>
      )}

      {/* Aviso de seguridad */}
      <Box
        sx={{
          p: 1.5,
          borderRadius: 2,
          background: alpha(COLORS.charcoal, 0.25),
          border: `1px solid ${alpha(COLORS.charcoal, 0.6)}`,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          🔒 El JWT y el mdstrm.id se cifran con <strong>AES-256-GCM</strong> antes de guardarse localmente. Nunca se envían a terceros.
        </Typography>
      </Box>

      {/* Submit */}
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={loading || !form.jwt.trim() || !form.sid.trim()}
        sx={{ alignSelf: 'flex-start', px: 4, fontWeight: 700 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: 'inherit' }} />
            Importando…
          </Box>
        ) : (
          'Importar credenciales'
        )}
      </Button>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Helpers de UI
// ---------------------------------------------------------------------------

function StepInstruction({ number, children }: { number: number; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
      <Box
        sx={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: alpha(COLORS.neonGreen, 0.15),
          border: `1px solid ${alpha(COLORS.neonGreen, 0.4)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          mt: 0.1,
        }}
      >
        <Typography variant="caption" sx={{ color: COLORS.neonGreen, fontWeight: 700, fontSize: '0.7rem' }}>
          {number}
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
        {children}
      </Typography>
    </Box>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="code"
      sx={{
        px: 0.75,
        py: 0.2,
        borderRadius: 1,
        background: alpha(COLORS.charcoal, 0.5),
        color: COLORS.neonGreen,
        fontSize: '0.78rem',
        fontFamily: 'monospace',
      }}
    >
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Vista de sesión activa
// ---------------------------------------------------------------------------

interface ActiveSessionViewProps {
  session: SessionInfo;
  onLogout: () => void;
  onValidate: () => void;
  validating: boolean;
}

function ActiveSessionView({ session, onLogout, onValidate, validating }: ActiveSessionViewProps) {
  const expiresAt = new Date(session.expiresAt);
  const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Sesión activa
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ya tienes una sesión autenticada con Mediastream.
        </Typography>
      </Box>

      {/* Session card */}
      <Box
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: `1px solid ${alpha(COLORS.neonGreen, 0.3)}`,
          background: alpha(COLORS.neonGreen, 0.05),
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircleIcon sx={{ color: COLORS.neonGreen, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700} sx={{ color: COLORS.neonGreen }}>
              Conectado
            </Typography>
          </Box>
          <Chip
            label={hoursLeft > 0 ? `Expira en ${hoursLeft}h` : 'Próximo a expirar'}
            size="small"
            sx={{
              bgcolor: hoursLeft > 2 ? alpha(COLORS.sageGreen, 0.2) : alpha(COLORS.alertRed, 0.2),
              color: hoursLeft > 2 ? COLORS.sageGreen : COLORS.alertRed,
              border: `1px solid ${hoursLeft > 2 ? alpha(COLORS.sageGreen, 0.4) : alpha(COLORS.alertRed, 0.4)}`,
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        </Box>

        <Divider sx={{ opacity: 0.3 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <InfoRow label="Cuenta" value={session.accountName || session.accountId} highlight />
          <InfoRow label="Usuario" value={session.userEmail} />
          <InfoRow label="Plataforma" value={session.apiUrl} mono />
          <InfoRow label="ID de cuenta" value={session.accountId} mono />
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          onClick={onValidate}
          disabled={validating}
          startIcon={validating ? <CircularProgress size={14} /> : <RefreshIcon />}
          sx={{ borderColor: alpha(COLORS.neonGreen, 0.4), color: COLORS.neonGreen }}
        >
          {validating ? 'Verificando…' : 'Verificar sesión'}
        </Button>
        <Button
          variant="outlined"
          size="small"
          color="error"
          onClick={onLogout}
          startIcon={<LogoutIcon />}
        >
          Cerrar sesión
        </Button>
      </Box>
    </Box>
  );
}

function InfoRow({ label, value, highlight, mono }: {
  label: string; value: string; highlight?: boolean; mono?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{
          color: 'text.disabled',
          width: 80,
          flexShrink: 0,
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          fontWeight: highlight ? 600 : 400,
          color: highlight ? 'text.primary' : 'text.secondary',
          fontFamily: mono ? '"JetBrains Mono", "Consolas", monospace' : 'inherit',
          fontSize: mono ? '0.78rem' : '0.85rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
