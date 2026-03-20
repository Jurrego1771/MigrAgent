import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  IconButton,
  InputAdornment,
  Alert,
  Chip,
  CircularProgress,
  Divider,
  Collapse,
  alpha,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  CheckCircle as CheckCircleIcon,
  LockOpen as LockOpenIcon,
  Logout as LogoutIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { authApi } from '../../../services/api';
import { useWizard } from '../../../context/WizardContext';
import { SessionInfo } from '../../../types';
import { COLORS } from '../../../theme';

interface FormState {
  apiUrl: string;
  email: string;
  password: string;
  totp: string;
}

export default function AuthStep() {
  const { session, setSession } = useWizard();

  const [form, setForm] = useState<FormState>({
    apiUrl: 'https://platform.mediastre.am',
    email: '',
    password: '',
    totp: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [totpRequired, setTotpRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Al montar, verificar si ya hay sesión activa
  useEffect(() => {
    const checkExisting = async () => {
      try {
        const result = await authApi.getSession();
        if (result.authenticated && result.session) {
          setSession(result.session);
        }
      } catch {
        // Sin sesión activa — OK
      } finally {
        setSessionChecked(true);
      }
    };
    checkExisting();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email y contraseña son requeridos.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await authApi.login({
        email: form.email.trim(),
        password: form.password,
        apiUrl: form.apiUrl.trim() || undefined,
        totp: form.totp.trim() || undefined,
      });

      setSession(result.session);
      setTotpRequired(false);
    } catch (err: any) {
      const code = err?.response?.data?.code;
      const message = err?.response?.data?.error || err.message;

      if (code === 'TOTP_REQUIRED') {
        setTotpRequired(true);
        setError(null);
      } else {
        setError(message || 'Error al conectar con Mediastream.');
      }
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
        setError(result.reason || 'La sesión ya no es válida. Inicia sesión nuevamente.');
      }
    } catch {
      setError('No se pudo verificar la sesión.');
    } finally {
      setValidating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignorar error de logout
    }
    setSession(null);
    setError(null);
    setTotpRequired(false);
  };

  if (!sessionChecked) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <CircularProgress size={32} sx={{ color: COLORS.neonGreen }} />
      </Box>
    );
  }

  // Vista: sesión activa
  if (session) {
    return <ActiveSessionView session={session} onLogout={handleLogout} onValidate={handleValidate} validating={validating} />;
  }

  // Vista: formulario de login
  return (
    <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>

      {/* Header */}
      <Box sx={{ mb: 1 }}>
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Conectar con Mediastream
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Ingresa tus credenciales para autenticarte en la plataforma. Las credenciales se almacenan cifradas localmente.
        </Typography>
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
            <InputAdornment position="start">
              <LinkIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
        helperText="URL base de tu instancia de Mediastream"
      />

      <Divider />

      {/* Email */}
      <TextField
        label="Email"
        type="email"
        value={form.email}
        onChange={handleChange('email')}
        fullWidth
        autoComplete="email"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <PersonIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
        }}
      />

      {/* Password */}
      <TextField
        label="Contraseña"
        type={showPassword ? 'text' : 'password'}
        value={form.password}
        onChange={handleChange('password')}
        fullWidth
        autoComplete="current-password"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <LockOpenIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              <IconButton onClick={() => setShowPassword((v) => !v)} size="small" edge="end" tabIndex={-1}>
                {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {/* TOTP — solo si se requiere */}
      <Collapse in={totpRequired}>
        <Box>
          <Alert severity="info" sx={{ mb: 1.5, fontSize: '0.8rem' }}>
            Esta cuenta tiene autenticación en dos pasos activada. Ingresa tu código TOTP.
          </Alert>
          <TextField
            label="Código TOTP (6 dígitos)"
            value={form.totp}
            onChange={handleChange('totp')}
            fullWidth
            inputProps={{ maxLength: 6, inputMode: 'numeric', pattern: '[0-9]*' }}
            autoFocus={totpRequired}
          />
        </Box>
      </Collapse>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          {error}
        </Alert>
      )}

      {/* Aviso de seguridad */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          p: 1.5,
          borderRadius: 2,
          background: alpha(COLORS.charcoal, 0.25),
          border: `1px solid ${alpha(COLORS.charcoal, 0.6)}`,
        }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.5 }}>
          🔒 Las credenciales se cifran con <strong>AES-256-GCM</strong> antes de persistirse. La contraseña nunca se almacena — solo el JWT y la cookie de sesión resultantes.
        </Typography>
      </Box>

      {/* Submit */}
      <Button
        type="submit"
        variant="contained"
        size="large"
        disabled={loading || !form.email || !form.password}
        sx={{ alignSelf: 'flex-start', px: 4, fontWeight: 700 }}
      >
        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: 'inherit' }} />
            Conectando…
          </Box>
        ) : (
          'Iniciar sesión'
        )}
      </Button>
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
      <Box sx={{ mb: 1 }}>
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
        {/* Status badge */}
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
              bgcolor: hoursLeft > 2
                ? alpha(COLORS.sageGreen, 0.2)
                : alpha(COLORS.alertRed, 0.2),
              color: hoursLeft > 2 ? COLORS.sageGreen : COLORS.alertRed,
              border: `1px solid ${hoursLeft > 2 ? alpha(COLORS.sageGreen, 0.4) : alpha(COLORS.alertRed, 0.4)}`,
              fontWeight: 600,
              fontSize: '0.7rem',
            }}
          />
        </Box>

        <Divider sx={{ opacity: 0.3 }} />

        {/* Account info */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <InfoRow label="Cuenta" value={session.accountName || session.accountId} highlight />
          <InfoRow label="Usuario" value={session.userEmail} />
          <InfoRow label="Plataforma" value={session.apiUrl} mono />
          <InfoRow label="ID de cuenta" value={session.accountId} mono />
        </Box>
      </Box>

      {/* Actions */}
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

function InfoRow({
  label,
  value,
  highlight,
  mono,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
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
