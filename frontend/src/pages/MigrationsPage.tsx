import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Skeleton,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  Search as SearchIcon,
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RetryIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import {
  useMigrations,
  useDeleteMigration,
  useStartMigration,
  useStopMigration,
  useRetryMigration,
} from '../hooks/useApi';
import { useApp } from '../context/AppContext';
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

export default function MigrationsPage() {
  const navigate = useNavigate();
  const { showNotification } = useApp();
  const { data: migrations, isLoading } = useMigrations();
  const deleteMutation = useDeleteMigration();
  const startMutation = useStartMigration();
  const stopMutation = useStopMigration();
  const retryMutation = useRetryMigration();

  const [searchQuery, setSearchQuery] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMigration, setSelectedMigration] = useState<Migration | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const filteredMigrations = migrations?.filter((m) =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, migration: Migration) => {
    setAnchorEl(event.currentTarget);
    setSelectedMigration(migration);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMigration(null);
  };

  const handleDelete = async () => {
    if (!selectedMigration) return;

    try {
      await deleteMutation.mutateAsync(selectedMigration.id);
      showNotification('Migración eliminada correctamente', 'success');
    } catch (error) {
      showNotification('Error al eliminar la migración', 'error');
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const handleStart = async (migration: Migration) => {
    try {
      await startMutation.mutateAsync(migration.id);
      showNotification('Migración iniciada', 'success');
    } catch (error) {
      showNotification('Error al iniciar la migración', 'error');
    }
    handleMenuClose();
  };

  const handleStop = async (migration: Migration) => {
    try {
      await stopMutation.mutateAsync(migration.id);
      showNotification('Migración pausada', 'success');
    } catch (error) {
      showNotification('Error al pausar la migración', 'error');
    }
    handleMenuClose();
  };

  const handleRetry = async (migration: Migration) => {
    try {
      await retryMutation.mutateAsync(migration.id);
      showNotification('Reintento iniciado', 'success');
    } catch (error) {
      showNotification('Error al reintentar', 'error');
    }
    handleMenuClose();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Migraciones</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/migrations/new')}
        >
          Nueva Migración
        </Button>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              placeholder="Buscar migraciones..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
              sx={{ width: 300 }}
            />
          </Box>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Nombre</TableCell>
                  <TableCell>Estado</TableCell>
                  <TableCell>Estrategia</TableCell>
                  <TableCell>Progreso</TableCell>
                  <TableCell>Errores</TableCell>
                  <TableCell>Fecha</TableCell>
                  <TableCell align="right">Acciones</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredMigrations && filteredMigrations.length > 0 ? (
                  filteredMigrations.map((migration) => {
                    const progress =
                      migration.totalItems > 0
                        ? (migration.processedItems / migration.totalItems) * 100
                        : 0;

                    return (
                      <TableRow
                        key={migration.id}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/migrations/${migration.id}`)}
                      >
                        <TableCell>
                          <Typography fontWeight="medium">{migration.name}</Typography>
                          {migration.csvFileName && (
                            <Typography variant="caption" color="text.secondary">
                              {migration.csvFileName}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={statusConfig[migration.status].label}
                            color={statusConfig[migration.status].color}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={migration.strategy === 'transcode' ? 'Transcodificar' : 'Upload'}
                            variant="outlined"
                            size="small"
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={progress}
                              sx={{ flexGrow: 1 }}
                            />
                            <Typography variant="caption" sx={{ minWidth: 45 }}>
                              {progress.toFixed(0)}%
                            </Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {migration.processedItems.toLocaleString()} /{' '}
                            {migration.totalItems.toLocaleString()}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {migration.errorItems > 0 ? (
                            <Chip
                              label={migration.errorItems}
                              color="error"
                              size="small"
                            />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(migration.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMenuOpen(e, migration);
                            }}
                          >
                            <MoreIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">
                        No hay migraciones
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Actions Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
        <MenuItem
          onClick={() => {
            if (selectedMigration) navigate(`/migrations/${selectedMigration.id}`);
            handleMenuClose();
          }}
        >
          <ViewIcon sx={{ mr: 1 }} /> Ver detalles
        </MenuItem>
        {selectedMigration?.status === 'paused' || selectedMigration?.status === 'validated' ? (
          <MenuItem onClick={() => selectedMigration && handleStart(selectedMigration)}>
            <PlayIcon sx={{ mr: 1 }} /> Iniciar
          </MenuItem>
        ) : selectedMigration?.status === 'running' ? (
          <MenuItem onClick={() => selectedMigration && handleStop(selectedMigration)}>
            <PauseIcon sx={{ mr: 1 }} /> Pausar
          </MenuItem>
        ) : null}
        {(selectedMigration?.status === 'done' || selectedMigration?.status === 'paused') &&
          selectedMigration?.errorItems > 0 && (
            <MenuItem onClick={() => selectedMigration && handleRetry(selectedMigration)}>
              <RetryIcon sx={{ mr: 1 }} /> Reintentar errores
            </MenuItem>
          )}
        <MenuItem
          onClick={() => setDeleteDialogOpen(true)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Eliminar
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Eliminar migración</DialogTitle>
        <DialogContent>
          <DialogContentText>
            ¿Estás seguro de que deseas eliminar la migración "{selectedMigration?.name}"?
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
    </Box>
  );
}
