import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Grid,
  Alert,
  CircularProgress,
  Divider,
  InputAdornment,
  Chip,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useSettings, useUpdateSettings, useTestConnection } from '../hooks/useApi';
import { useApp } from '../context/AppContext';

export default function SettingsPage() {
  const { showNotification } = useApp();
  const { data: settings, isLoading } = useSettings();
  const updateMutation = useUpdateSettings();
  const testConnectionMutation = useTestConnection();

  const [formData, setFormData] = useState({
    mediastreamApiUrl: '',
    mediastreamAccountId: '',
    alertOnStalled: true,
    stalledThresholdMs: 900000,
    alertOnErrorThreshold: true,
    errorThresholdPercent: 10,
    urlCheckTimeout: 10000,
    urlCheckConcurrency: 5,
  });

  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        mediastreamApiUrl: settings.mediastreamApiUrl || '',
        mediastreamAccountId: settings.mediastreamAccountId || '',
        alertOnStalled: settings.alertOnStalled,
        stalledThresholdMs: settings.stalledThresholdMs,
        alertOnErrorThreshold: settings.alertOnErrorThreshold,
        errorThresholdPercent: settings.errorThresholdPercent,
        urlCheckTimeout: settings.urlCheckTimeout,
        urlCheckConcurrency: settings.urlCheckConcurrency,
      });
    }
  }, [settings]);

  const handleChange = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      await updateMutation.mutateAsync(formData);
      showNotification('Configuración guardada correctamente', 'success');
    } catch (error) {
      showNotification('Error al guardar la configuración', 'error');
    }
  };

  const handleTestConnection = async () => {
    setConnectionStatus('testing');
    setConnectionError(null);

    try {
      const result = await testConnectionMutation.mutateAsync();
      if (result.success) {
        setConnectionStatus('success');
        showNotification('Conexión exitosa con Mediastream', 'success');
      } else {
        setConnectionStatus('error');
        setConnectionError(result.error || 'Error desconocido');
      }
    } catch (error) {
      setConnectionStatus('error');
      setConnectionError('Error al probar la conexión');
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Configuración
      </Typography>

      <Grid container spacing={3}>
        {/* Mediastream API */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Conexión a Mediastream
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configura la conexión con la API de Mediastream. El token se
                configura en las variables de entorno del servidor.
              </Typography>

              <TextField
                label="URL de la API"
                value={formData.mediastreamApiUrl}
                onChange={(e) => handleChange('mediastreamApiUrl', e.target.value)}
                fullWidth
                sx={{ mb: 2 }}
                helperText="URL base de la API de Mediastream"
              />

              <TextField
                label="Account ID"
                value={formData.mediastreamAccountId}
                onChange={(e) => handleChange('mediastreamAccountId', e.target.value)}
                fullWidth
                sx={{ mb: 3 }}
                helperText="ID de la cuenta en Mediastream"
              />

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Button
                  variant="outlined"
                  onClick={handleTestConnection}
                  disabled={connectionStatus === 'testing'}
                  startIcon={
                    connectionStatus === 'testing' ? (
                      <CircularProgress size={20} />
                    ) : (
                      <RefreshIcon />
                    )
                  }
                >
                  Probar Conexión
                </Button>

                {connectionStatus === 'success' && (
                  <Chip
                    icon={<CheckIcon />}
                    label="Conectado"
                    color="success"
                    variant="outlined"
                  />
                )}
                {connectionStatus === 'error' && (
                  <Chip
                    icon={<ErrorIcon />}
                    label="Error"
                    color="error"
                    variant="outlined"
                  />
                )}
              </Box>

              {connectionError && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {connectionError}
                </Alert>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Alertas */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Configuración de Alertas
              </Typography>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.alertOnStalled}
                    onChange={(e) => handleChange('alertOnStalled', e.target.checked)}
                  />
                }
                label="Alertar cuando una migración esté estancada"
                sx={{ mb: 2, display: 'block' }}
              />

              {formData.alertOnStalled && (
                <TextField
                  label="Umbral de estancamiento"
                  type="number"
                  value={formData.stalledThresholdMs / 60000}
                  onChange={(e) =>
                    handleChange('stalledThresholdMs', parseInt(e.target.value) * 60000)
                  }
                  InputProps={{
                    endAdornment: <InputAdornment position="end">minutos</InputAdornment>,
                  }}
                  fullWidth
                  sx={{ mb: 3 }}
                  helperText="Tiempo sin progreso para considerar estancada"
                />
              )}

              <Divider sx={{ my: 2 }} />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.alertOnErrorThreshold}
                    onChange={(e) =>
                      handleChange('alertOnErrorThreshold', e.target.checked)
                    }
                  />
                }
                label="Alertar cuando se supere el umbral de errores"
                sx={{ mb: 2, display: 'block' }}
              />

              {formData.alertOnErrorThreshold && (
                <TextField
                  label="Porcentaje de errores"
                  type="number"
                  value={formData.errorThresholdPercent}
                  onChange={(e) =>
                    handleChange('errorThresholdPercent', parseInt(e.target.value))
                  }
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  fullWidth
                  helperText="Porcentaje de errores para generar alerta"
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Validación de URLs */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Validación de URLs
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configura cómo se validan las URLs durante el análisis del CSV.
              </Typography>

              <TextField
                label="Timeout de verificación"
                type="number"
                value={formData.urlCheckTimeout / 1000}
                onChange={(e) =>
                  handleChange('urlCheckTimeout', parseInt(e.target.value) * 1000)
                }
                InputProps={{
                  endAdornment: <InputAdornment position="end">segundos</InputAdornment>,
                }}
                fullWidth
                sx={{ mb: 2 }}
                helperText="Tiempo máximo de espera por URL"
              />

              <TextField
                label="Concurrencia"
                type="number"
                value={formData.urlCheckConcurrency}
                onChange={(e) =>
                  handleChange('urlCheckConcurrency', parseInt(e.target.value))
                }
                InputProps={{
                  endAdornment: <InputAdornment position="end">URLs</InputAdornment>,
                }}
                fullWidth
                helperText="Número de URLs a verificar en paralelo"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Información del Sistema */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información del Sistema
              </Typography>

              <Box sx={{ display: 'grid', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Versión:</Typography>
                  <Typography>1.0.0</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Backend:</Typography>
                  <Typography>Node.js + Express</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Base de datos:</Typography>
                  <Typography>SQLite</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Frontend:</Typography>
                  <Typography>React + Material UI</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="body2" color="text.secondary">
                Helpper Migrator es una herramienta para gestionar y validar
                migraciones de contenido hacia Mediastream de forma eficiente y
                controlada.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <CircularProgress size={24} />
          ) : (
            'Guardar Configuración'
          )}
        </Button>
      </Box>
    </Box>
  );
}
