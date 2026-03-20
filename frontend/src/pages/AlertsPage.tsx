import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  IconButton,
  Chip,
  Tabs,
  Tab,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  CheckCircle as CheckIcon,
  DoneAll as DoneAllIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useAlerts, useAcknowledgeAlert, useAcknowledgeAllAlerts } from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { Alert } from '../types';

const severityConfig = {
  info: { icon: <InfoIcon />, color: 'info' as const },
  warning: { icon: <WarningIcon />, color: 'warning' as const },
  critical: { icon: <ErrorIcon />, color: 'error' as const },
};

const typeLabels: Record<string, string> = {
  stalled: 'Estancado',
  error_threshold: 'Umbral de errores',
  retry_exhausted: 'Reintentos agotados',
  completed: 'Completado',
};

export default function AlertsPage() {
  const navigate = useNavigate();
  const { showNotification } = useApp();
  const [tab, setTab] = useState(0);

  const { data: unacknowledgedAlerts, isLoading: loadingUnack } = useAlerts({
    acknowledged: false,
  });
  const { data: acknowledgedAlerts, isLoading: loadingAck } = useAlerts({
    acknowledged: true,
    limit: 50,
  });

  const acknowledgeMutation = useAcknowledgeAlert();
  const acknowledgeAllMutation = useAcknowledgeAllAlerts();

  const handleAcknowledge = async (id: string) => {
    try {
      await acknowledgeMutation.mutateAsync(id);
      showNotification('Alerta marcada como leída', 'success');
    } catch (error) {
      showNotification('Error al marcar la alerta', 'error');
    }
  };

  const handleAcknowledgeAll = async () => {
    try {
      await acknowledgeAllMutation.mutateAsync(undefined);
      showNotification('Todas las alertas marcadas como leídas', 'success');
    } catch (error) {
      showNotification('Error al marcar las alertas', 'error');
    }
  };

  const alerts = tab === 0 ? unacknowledgedAlerts : acknowledgedAlerts;
  const isLoading = tab === 0 ? loadingUnack : loadingAck;

  const AlertListItem = ({ alert }: { alert: Alert }) => {
    const config = severityConfig[alert.severity];

    return (
      <ListItem
        sx={{
          bgcolor: 'background.default',
          borderRadius: 2,
          mb: 1,
          border: 1,
          borderColor: alert.acknowledged ? 'divider' : `${config.color}.light`,
        }}
      >
        <ListItemIcon sx={{ color: `${config.color}.main` }}>
          {config.icon}
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1">{alert.message}</Typography>
              <Chip
                label={typeLabels[alert.type] || alert.type}
                size="small"
                color={config.color}
                variant="outlined"
              />
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                {new Date(alert.createdAt).toLocaleString()}
              </Typography>
              {alert.migration && (
                <Typography variant="caption" color="primary">
                  Migración: {alert.migration.name}
                </Typography>
              )}
            </Box>
          }
        />
        <ListItemSecondaryAction>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {alert.migrationId && (
              <Tooltip title="Ver migración">
                <IconButton
                  size="small"
                  onClick={() => navigate(`/migrations/${alert.migrationId}`)}
                >
                  <ViewIcon />
                </IconButton>
              </Tooltip>
            )}
            {!alert.acknowledged && (
              <Tooltip title="Marcar como leída">
                <IconButton
                  size="small"
                  onClick={() => handleAcknowledge(alert.id)}
                  color="primary"
                >
                  <CheckIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Alertas</Typography>
        {unacknowledgedAlerts && unacknowledgedAlerts.length > 0 && (
          <Button
            startIcon={<DoneAllIcon />}
            onClick={handleAcknowledgeAll}
            disabled={acknowledgeAllMutation.isPending}
          >
            Marcar todas como leídas
          </Button>
        )}
      </Box>

      <Card>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Pendientes
                {unacknowledgedAlerts && unacknowledgedAlerts.length > 0 && (
                  <Chip
                    label={unacknowledgedAlerts.length}
                    size="small"
                    color="error"
                  />
                )}
              </Box>
            }
          />
          <Tab label="Historial" />
        </Tabs>

        <CardContent>
          {isLoading ? (
            <Box>
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} height={80} sx={{ mb: 1 }} />
              ))}
            </Box>
          ) : alerts && alerts.length > 0 ? (
            <List disablePadding>
              {alerts.map((alert) => (
                <AlertListItem key={alert.id} alert={alert} />
              ))}
            </List>
          ) : (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <CheckIcon sx={{ fontSize: 64, color: 'success.light', mb: 2 }} />
              <Typography color="text.secondary">
                {tab === 0
                  ? 'No hay alertas pendientes'
                  : 'No hay alertas en el historial'}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
