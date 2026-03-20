import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Visibility as ViewIcon,
  CloudUpload as MigrationIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useMigrations, useAlerts } from '../hooks/useApi';
import { Migration, MigrationStatus } from '../types';

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: migrations, isLoading: loadingMigrations } = useMigrations();
  const { data: alerts } = useAlerts({ acknowledged: false, limit: 5 });

  const activeMigrations = migrations?.filter(
    (m) => m.status === 'running' || m.status === 'validating'
  );
  const completedMigrations = migrations?.filter((m) => m.status === 'done');
  const errorMigrations = migrations?.filter((m) => m.status === 'error');

  const totalItems = migrations?.reduce((acc, m) => acc + m.totalItems, 0) || 0;
  const processedItems = migrations?.reduce((acc, m) => acc + m.processedItems, 0) || 0;

  const StatCard = ({
    title,
    value,
    icon,
    color,
  }: {
    title: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
  }) => (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              bgcolor: `${color}.light`,
              color: `${color}.main`,
              p: 1.5,
              borderRadius: 2,
              display: 'flex',
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography color="text.secondary" variant="body2">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold">
              {value}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/migrations/new')}
        >
          Nueva Migración
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Migraciones Activas"
            value={loadingMigrations ? '-' : activeMigrations?.length || 0}
            icon={<MigrationIcon />}
            color="primary"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Completadas"
            value={loadingMigrations ? '-' : completedMigrations?.length || 0}
            icon={<SuccessIcon />}
            color="success"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Con Errores"
            value={loadingMigrations ? '-' : errorMigrations?.length || 0}
            icon={<ErrorIcon />}
            color="error"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Items Procesados"
            value={loadingMigrations ? '-' : processedItems.toLocaleString()}
            icon={<PendingIcon />}
            color="info"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Active Migrations */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Migraciones Activas
              </Typography>

              {loadingMigrations ? (
                <Box>
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} height={80} sx={{ my: 1 }} />
                  ))}
                </Box>
              ) : activeMigrations && activeMigrations.length > 0 ? (
                <List>
                  {activeMigrations.map((migration) => (
                    <MigrationListItem
                      key={migration.id}
                      migration={migration}
                      onView={() => navigate(`/migrations/${migration.id}`)}
                    />
                  ))}
                </List>
              ) : (
                <Box
                  sx={{
                    textAlign: 'center',
                    py: 4,
                    color: 'text.secondary',
                  }}
                >
                  <MigrationIcon sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
                  <Typography>No hay migraciones activas</Typography>
                  <Button
                    variant="outlined"
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/migrations/new')}
                  >
                    Crear una migración
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Alerts */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Alertas Recientes</Typography>
                <Button size="small" onClick={() => navigate('/alerts')}>
                  Ver todas
                </Button>
              </Box>

              {alerts && alerts.length > 0 ? (
                <List dense>
                  {alerts.map((alert) => (
                    <ListItem key={alert.id}>
                      <ListItemText
                        primary={alert.message}
                        secondary={new Date(alert.createdAt).toLocaleString()}
                        primaryTypographyProps={{
                          variant: 'body2',
                          noWrap: true,
                        }}
                      />
                      <Chip
                        label={alert.severity}
                        size="small"
                        color={
                          alert.severity === 'critical'
                            ? 'error'
                            : alert.severity === 'warning'
                              ? 'warning'
                              : 'info'
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                  No hay alertas pendientes
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function MigrationListItem({
  migration,
  onView,
}: {
  migration: Migration;
  onView: () => void;
}) {
  const progress =
    migration.totalItems > 0
      ? (migration.processedItems / migration.totalItems) * 100
      : 0;

  return (
    <ListItem
      sx={{
        bgcolor: 'background.default',
        borderRadius: 2,
        mb: 1,
        flexDirection: 'column',
        alignItems: 'stretch',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', mb: 1 }}>
        <ListItemText
          primary={migration.name}
          secondary={`${migration.processedItems.toLocaleString()} / ${migration.totalItems.toLocaleString()} items`}
        />
        <Chip
          label={statusConfig[migration.status].label}
          color={statusConfig[migration.status].color}
          size="small"
          sx={{ mr: 1 }}
        />
        <IconButton size="small" onClick={onView}>
          <ViewIcon />
        </IconButton>
      </Box>
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ width: '100%', borderRadius: 1 }}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          {progress.toFixed(1)}% completado
        </Typography>
        {migration.errorItems > 0 && (
          <Typography variant="caption" color="error">
            {migration.errorItems} errores
          </Typography>
        )}
      </Box>
    </ListItem>
  );
}
