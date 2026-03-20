import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  LinearProgress,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  Alert,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RetryIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Speed as SpeedIcon,
  Timer as TimerIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
  useMigration,
  useMigrationStats,
  useMigrationLogs,
  useMigrationValidation,
  useStartMigration,
  useStopMigration,
  useRetryMigration,
  useDeleteMigration,
  useCreateInMediastream,
  useValidateMigration,
} from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { MigrationStatus, MappingConfig, CSVValidationError } from '../types';
import { useDropzone } from 'react-dropzone';

const statusConfig: Record<
  MigrationStatus,
  { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; label: string }
> = {
  created: { color: 'default', label: 'Creada' },
  validating: { color: 'info', label: 'Validando' },
  validated: { color: 'success', label: 'Validada' },
  running: { color: 'primary', label: 'En Progreso' },
  paused: { color: 'warning', label: 'Pausada' },
  done: { color: 'success', label: 'Completada' },
  error: { color: 'error', label: 'Error' },
};

export default function MigrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showNotification } = useApp();

  const { data: migration, isLoading, refetch } = useMigration(id!);
  const { data: stats } = useMigrationStats(id!, migration?.status === 'running');
  const { data: logs } = useMigrationLogs(id!, { limit: 50 });
  const { data: validation } = useMigrationValidation(id!);

  const startMutation = useStartMigration();
  const stopMutation = useStopMigration();
  const retryMutation = useRetryMigration();
  const deleteMutation = useDeleteMigration();
  const createInMSMutation = useCreateInMediastream();
  const validateMutation = useValidateMigration();

  const [activeTab, setActiveTab] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleStart = async () => {
    try {
      // Si no tiene mediastreamConfigId, primero crear en Mediastream
      if (!migration?.mediastreamConfigId) {
        await createInMSMutation.mutateAsync(id!);
      }
      await startMutation.mutateAsync(id!);
      showNotification('Migración iniciada', 'success');
      refetch();
    } catch (error) {
      showNotification('Error al iniciar la migración', 'error');
    }
  };

  const handleStop = async () => {
    try {
      await stopMutation.mutateAsync(id!);
      showNotification('Migración pausada', 'success');
      refetch();
    } catch (error) {
      showNotification('Error al pausar la migración', 'error');
    }
  };

  const handleRetry = async () => {
    try {
      await retryMutation.mutateAsync(id!);
      showNotification('Reintento iniciado', 'success');
      refetch();
    } catch (error) {
      showNotification('Error al reintentar', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(id!);
      showNotification('Migración eliminada', 'success');
      navigate('/migrations');
    } catch (error) {
      showNotification('Error al eliminar la migración', 'error');
    }
    setDeleteDialogOpen(false);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => {
      if (files.length > 0) {
        try {
          await validateMutation.mutateAsync({ id: id!, file: files[0], checkUrls: true });
          showNotification('CSV validado correctamente', 'success');
          setUploadDialogOpen(false);
          refetch();
        } catch (error) {
          showNotification('Error al validar el CSV', 'error');
        }
      }
    },
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  if (isLoading) {
    return (
      <Box>
        <Skeleton height={60} />
        <Skeleton height={200} />
        <Skeleton height={400} />
      </Box>
    );
  }

  if (!migration) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography color="text.secondary">Migración no encontrada</Typography>
        <Button onClick={() => navigate('/migrations')} sx={{ mt: 2 }}>
          Volver a migraciones
        </Button>
      </Box>
    );
  }

  const mappings = JSON.parse(migration.mappings) as MappingConfig[];
  const progress = migration.totalItems > 0
    ? (migration.processedItems / migration.totalItems) * 100
    : 0;

  const errors = validation?.errors ? JSON.parse(validation.errors as unknown as string) as CSVValidationError[] : [];

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/migrations')}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">{migration.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
            <Chip
              label={statusConfig[migration.status].label}
              color={statusConfig[migration.status].color}
              size="small"
            />
            <Chip
              label={migration.strategy === 'transcode' ? 'Transcodificar' : 'Upload'}
              variant="outlined"
              size="small"
            />
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {migration.status === 'created' && (
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Cargar CSV
            </Button>
          )}
          {(migration.status === 'validated' || migration.status === 'paused') && (
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={handleStart}
              disabled={startMutation.isPending || createInMSMutation.isPending}
            >
              {startMutation.isPending || createInMSMutation.isPending ? (
                <CircularProgress size={20} />
              ) : (
                'Iniciar'
              )}
            </Button>
          )}
          {migration.status === 'running' && (
            <Button
              variant="outlined"
              startIcon={<PauseIcon />}
              onClick={handleStop}
              disabled={stopMutation.isPending}
            >
              Pausar
            </Button>
          )}
          {(migration.status === 'done' || migration.status === 'paused') &&
            migration.errorItems > 0 && (
              <Button
                variant="outlined"
                startIcon={<RetryIcon />}
                onClick={handleRetry}
                disabled={retryMutation.isPending}
              >
                Reintentar Errores
              </Button>
            )}
          <Tooltip title="Eliminar migración">
            <IconButton onClick={() => setDeleteDialogOpen(true)} color="error">
              <DeleteIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Progreso
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {migration.processedItems.toLocaleString()} /{' '}
                    {migration.totalItems.toLocaleString()} items
                  </Typography>
                  <Typography variant="body2" fontWeight="medium">
                    {progress.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{ height: 12, borderRadius: 2 }}
                />
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="success.main">
                      {migration.successItems.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Exitosos
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="error.main">
                      {migration.errorItems.toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Errores
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="primary.main">
                      {stats?.speed?.toFixed(1) || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Items/min
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography variant="h4" color="info.main">
                      {stats?.etaFormatted || '-'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ETA
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Información
              </Typography>
              <Box sx={{ display: 'grid', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Archivo:</Typography>
                  <Typography>{migration.csvFileName || '-'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Creada:</Typography>
                  <Typography>
                    {new Date(migration.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Reintentos:</Typography>
                  <Typography>
                    {migration.currentRetryCount} / {migration.maxRetries}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Auto-retry:</Typography>
                  <Typography>{migration.retryEnabled ? 'Sí' : 'No'}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Card>
        <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Mapeo de Campos" />
          <Tab label={`Errores (${errors.length})`} />
          <Tab label="Logs" />
        </Tabs>

        <CardContent>
          {/* Mappings Tab */}
          {activeTab === 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Campo Mediastream</TableCell>
                    <TableCell>Columna CSV</TableCell>
                    <TableCell>Opciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mappings.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell>{m.mapper}</TableCell>
                      <TableCell>{m.field}</TableCell>
                      <TableCell>
                        {m.options ? JSON.stringify(m.options) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Errors Tab */}
          {activeTab === 1 && (
            <Box>
              {errors.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fila</TableCell>
                        <TableCell>Campo</TableCell>
                        <TableCell>Error</TableCell>
                        <TableCell>Valor</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {errors.slice(0, 100).map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>{err.field}</TableCell>
                          <TableCell>
                            <Typography color="error">{err.error}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{err.value}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {errors.length > 100 && (
                    <Typography color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
                      Mostrando 100 de {errors.length} errores
                    </Typography>
                  )}
                </TableContainer>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No hay errores registrados
                </Typography>
              )}
            </Box>
          )}

          {/* Logs Tab */}
          {activeTab === 2 && (
            <Box>
              {logs && logs.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Fecha</TableCell>
                        <TableCell>Nivel</TableCell>
                        <TableCell>Categoría</TableCell>
                        <TableCell>Mensaje</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={log.level}
                              size="small"
                              color={
                                log.level === 'error'
                                  ? 'error'
                                  : log.level === 'warn'
                                    ? 'warning'
                                    : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell>{log.category}</TableCell>
                          <TableCell>{log.message}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No hay logs disponibles
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Eliminar migración</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar la migración "{migration.name}"?
            Esta acción no se puede deshacer.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cargar archivo CSV</DialogTitle>
        <DialogContent>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: 'pointer',
              mt: 2,
            }}
          >
            <input {...getInputProps()} />
            {validateMutation.isPending ? (
              <CircularProgress />
            ) : (
              <>
                <UploadIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography>Arrastra un archivo CSV o haz clic para seleccionar</Typography>
              </>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)}>Cancelar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
