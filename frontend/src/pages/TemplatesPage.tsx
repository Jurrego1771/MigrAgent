import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Skeleton,
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Star as StarIcon,
} from '@mui/icons-material';
import {
  useTemplates,
  useDeleteTemplate,
  useDuplicateTemplate,
} from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { Template } from '../types';

export default function TemplatesPage() {
  const { showNotification } = useApp();
  const { data: templates, isLoading } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const duplicateMutation = useDuplicateTemplate();

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateName, setDuplicateName] = useState('');

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, template: Template) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTemplate(template);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleDelete = async () => {
    if (!selectedTemplate) return;

    try {
      await deleteMutation.mutateAsync(selectedTemplate.id);
      showNotification('Template eliminado correctamente', 'success');
    } catch (error) {
      showNotification('Error al eliminar el template', 'error');
    }
    setDeleteDialogOpen(false);
    handleMenuClose();
  };

  const handleDuplicate = async () => {
    if (!selectedTemplate || !duplicateName.trim()) return;

    try {
      await duplicateMutation.mutateAsync({
        id: selectedTemplate.id,
        name: duplicateName,
      });
      showNotification('Template duplicado correctamente', 'success');
    } catch (error) {
      showNotification('Error al duplicar el template', 'error');
    }
    setDuplicateDialogOpen(false);
    setDuplicateName('');
    handleMenuClose();
  };

  const openDuplicateDialog = () => {
    if (selectedTemplate) {
      setDuplicateName(`${selectedTemplate.name} (copia)`);
      setDuplicateDialogOpen(true);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Templates</Typography>
      </Box>

      <Typography color="text.secondary" sx={{ mb: 3 }}>
        Los templates te permiten guardar configuraciones de mapeo reutilizables.
        Se detectan automáticamente al cargar un CSV con headers similares.
      </Typography>

      {isLoading ? (
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
            </Grid>
          ))}
        </Grid>
      ) : templates && templates.length > 0 ? (
        <Grid container spacing={3}>
          {templates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  '&:hover': { boxShadow: 4 },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box>
                      <Typography variant="h6" gutterBottom>
                        {template.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                      >
                        {template.description || 'Sin descripción'}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, template)}
                    >
                      <MoreIcon />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip
                      label={
                        template.strategy === 'transcode'
                          ? 'Transcodificar'
                          : 'Upload'
                      }
                      size="small"
                      variant="outlined"
                    />
                    <Chip
                      label={`${template.mappings.length} campos`}
                      size="small"
                      variant="outlined"
                    />
                  </Box>

                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.5,
                      color: 'text.secondary',
                    }}
                  >
                    <StarIcon fontSize="small" />
                    <Typography variant="body2">
                      Usado {template.usageCount} veces
                    </Typography>
                  </Box>
                </CardContent>

                <Box
                  sx={{
                    p: 2,
                    pt: 0,
                    borderTop: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    Headers esperados:
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {template.expectedHeaders.slice(0, 4).map((h) => (
                      <Chip key={h} label={h} size="small" />
                    ))}
                    {template.expectedHeaders.length > 4 && (
                      <Chip
                        label={`+${template.expectedHeaders.length - 4}`}
                        size="small"
                        variant="outlined"
                      />
                    )}
                  </Box>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Typography color="text.secondary" gutterBottom>
              No hay templates creados
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Los templates se crean automáticamente cuando guardas una
              configuración de migración.
            </Typography>
          </CardContent>
        </Card>
      )}

      {/* Actions Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={openDuplicateDialog}>
          <DuplicateIcon sx={{ mr: 1 }} /> Duplicar
        </MenuItem>
        <MenuItem
          onClick={() => setDeleteDialogOpen(true)}
          sx={{ color: 'error.main' }}
        >
          <DeleteIcon sx={{ mr: 1 }} /> Eliminar
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Eliminar template</DialogTitle>
        <DialogContent>
          <Typography>
            ¿Estás seguro de que deseas eliminar el template "
            {selectedTemplate?.name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Eliminar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog
        open={duplicateDialogOpen}
        onClose={() => setDuplicateDialogOpen(false)}
      >
        <DialogTitle>Duplicar template</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Nombre del nuevo template"
            fullWidth
            value={duplicateName}
            onChange={(e) => setDuplicateName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDuplicateDialogOpen(false)}>Cancelar</Button>
          <Button
            onClick={handleDuplicate}
            variant="contained"
            disabled={!duplicateName.trim()}
          >
            Duplicar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
