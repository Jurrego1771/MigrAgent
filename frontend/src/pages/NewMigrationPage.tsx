import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stepper,
  Step,
  StepLabel,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Autocomplete,
  Switch,
  FormControlLabel,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  AutoAwesome as AutoIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import {
  useCreateMigration,
  useAnalyzeCSV,
  useTemplates,
  useDetectTemplate,
  useMapperOptions,
} from '../hooks/useApi';
import { useApp } from '../context/AppContext';
import { MappingConfig, DetectedMapping, Template, CSVAnalysisResult } from '../types';

const steps = ['Configuración Básica', 'Cargar CSV', 'Configurar Campos', 'Revisar'];

export default function NewMigrationPage() {
  const navigate = useNavigate();
  const { showNotification } = useApp();
  const createMutation = useCreateMigration();
  const analyzeCSVMutation = useAnalyzeCSV();
  const detectTemplateMutation = useDetectTemplate();
  const { data: templates } = useTemplates();
  const { data: mapperOptions } = useMapperOptions();

  const [activeStep, setActiveStep] = useState(0);
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<'transcode' | 'upload'>('transcode');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [csvAnalysis, setCsvAnalysis] = useState<CSVAnalysisResult | null>(null);
  const [mappings, setMappings] = useState<MappingConfig[]>([]);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [autoRetry, setAutoRetry] = useState(true);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        const uploadedFile = acceptedFiles[0];
        setFile(uploadedFile);

        try {
          // Analizar CSV
          const analysis = await analyzeCSVMutation.mutateAsync(uploadedFile);
          setCsvAnalysis(analysis);

          // Intentar detectar template
          const templateResult = await detectTemplateMutation.mutateAsync(analysis.headers);
          if (templateResult.found && templateResult.template) {
            setSelectedTemplate(templateResult.template);
            setMappings(templateResult.template.mappings);
            setStrategy(templateResult.template.strategy);
            showNotification(
              `Template "${templateResult.template.name}" detectado automáticamente`,
              'info'
            );
          } else {
            // Usar mapeos detectados automáticamente
            const autoMappings = analysis.detectedMappings
              .filter((d) => d.confidence >= 0.7)
              .map((d) => ({
                mapper: d.suggestedMapper,
                field: d.field,
              }));
            setMappings(autoMappings);
          }
        } catch (error) {
          showNotification('Error al analizar el archivo CSV', 'error');
        }
      }
    },
    [analyzeCSVMutation, detectTemplateMutation, showNotification]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  });

  const handleTemplateSelect = (template: Template | null) => {
    setSelectedTemplate(template);
    if (template) {
      setMappings(template.mappings);
      setStrategy(template.strategy);
    }
  };

  const handleMappingChange = (index: number, field: 'mapper' | 'field', value: string) => {
    const newMappings = [...mappings];
    newMappings[index] = { ...newMappings[index], [field]: value };
    setMappings(newMappings);
  };

  const handleAddMapping = () => {
    setMappings([...mappings, { mapper: '', field: '' }]);
  };

  const handleRemoveMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      handleCreate();
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
  };

  const handleCreate = async () => {
    try {
      const migration = await createMutation.mutateAsync({
        name,
        strategy,
        mappings,
        templateId: selectedTemplate?.id,
        retryPolicy: {
          enabled: autoRetry,
          maxRetries: 3,
          backoffType: 'exponential',
          initialDelay: 60000,
          maxDelay: 3600000,
        },
      });
      showNotification('Migración creada correctamente', 'success');
      navigate(`/migrations/${migration.id}`);
    } catch (error) {
      showNotification('Error al crear la migración', 'error');
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return name.trim() !== '';
      case 1:
        return file !== null && csvAnalysis !== null;
      case 2:
        const hasIdMapper = mappings.some((m) => m.mapper === 'id' && m.field);
        const hasTitleMapper = mappings.some((m) => m.mapper === 'title' && m.field);
        const hasUrlMapper = mappings.some(
          (m) => (m.mapper === 'original' || m.mapper === 'rendition') && m.field
        );
        return hasIdMapper && hasTitleMapper && hasUrlMapper;
      default:
        return true;
    }
  };

  const availableMappers = mapperOptions?.filter(
    (m) => !m.strategy || m.strategy === strategy
  );

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Nueva Migración
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stepper activeStep={activeStep} alternativeLabel>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {/* Step 0: Configuración Básica */}
          {activeStep === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Configuración Básica
              </Typography>

              <TextField
                label="Nombre de la migración"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                sx={{ mb: 3 }}
                helperText="Un nombre descriptivo para identificar esta migración"
              />

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Estrategia</InputLabel>
                <Select
                  value={strategy}
                  label="Estrategia"
                  onChange={(e) => setStrategy(e.target.value as 'transcode' | 'upload')}
                >
                  <MenuItem value="transcode">
                    Transcodificar - Descargar y procesar videos desde URLs
                  </MenuItem>
                  <MenuItem value="upload">
                    Upload - Importar archivos pre-transcodificados
                  </MenuItem>
                </Select>
              </FormControl>

              {templates && templates.length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Usar Template (opcional)
                  </Typography>
                  <Autocomplete
                    options={templates}
                    getOptionLabel={(option) => option.name}
                    value={selectedTemplate}
                    onChange={(_, value) => handleTemplateSelect(value)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        placeholder="Seleccionar template..."
                        helperText="Reutiliza una configuración de mapeo existente"
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props}>
                        <Box>
                          <Typography>{option.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.description} - Usado {option.usageCount} veces
                          </Typography>
                        </Box>
                      </li>
                    )}
                  />
                </Box>
              )}
            </Box>
          )}

          {/* Step 1: Cargar CSV */}
          {activeStep === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Cargar Archivo CSV
              </Typography>

              <Box
                {...getRootProps()}
                sx={{
                  border: '2px dashed',
                  borderColor: isDragActive ? 'primary.main' : 'divider',
                  borderRadius: 2,
                  p: 4,
                  textAlign: 'center',
                  cursor: 'pointer',
                  bgcolor: isDragActive ? 'action.hover' : 'background.default',
                  mb: 3,
                }}
              >
                <input {...getInputProps()} />
                {analyzeCSVMutation.isPending ? (
                  <Box>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography>Analizando archivo...</Typography>
                  </Box>
                ) : file ? (
                  <Box>
                    <CheckIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                    <Typography variant="h6">{file.name}</Typography>
                    <Typography color="text.secondary">
                      {csvAnalysis?.rowCount.toLocaleString()} filas detectadas
                    </Typography>
                    <Button
                      startIcon={<DeleteIcon />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                        setCsvAnalysis(null);
                      }}
                      sx={{ mt: 1 }}
                    >
                      Cambiar archivo
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <UploadIcon sx={{ fontSize: 48, mb: 1, color: 'text.secondary' }} />
                    <Typography>
                      {isDragActive
                        ? 'Suelta el archivo aquí...'
                        : 'Arrastra un archivo CSV o haz clic para seleccionar'}
                    </Typography>
                  </Box>
                )}
              </Box>

              {csvAnalysis && (
                <Box>
                  {/* Detección automática */}
                  {selectedTemplate && (
                    <Alert severity="success" sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <AutoIcon />
                        Template "{selectedTemplate.name}" detectado automáticamente
                      </Box>
                    </Alert>
                  )}

                  {/* Campos detectados */}
                  <Typography variant="subtitle1" gutterBottom>
                    Campos detectados ({csvAnalysis.headers.length})
                  </Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
                    {csvAnalysis.headers.map((header) => {
                      const detected = csvAnalysis.detectedMappings?.find(
                        (d) => d.field === header
                      );
                      return (
                        <Chip
                          key={header}
                          label={header}
                          color={detected && detected.confidence >= 0.7 ? 'primary' : 'default'}
                          variant={detected ? 'filled' : 'outlined'}
                          size="small"
                        />
                      );
                    })}
                  </Box>

                  {/* Advertencias */}
                  {csvAnalysis.warnings.length > 0 && (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Advertencias:</Typography>
                      <List dense>
                        {csvAnalysis.warnings.slice(0, 3).map((w, i) => (
                          <ListItem key={i}>
                            <ListItemText primary={w.warning} />
                          </ListItem>
                        ))}
                      </List>
                    </Alert>
                  )}

                  {/* Preview */}
                  {csvAnalysis.preview.length > 0 && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Vista previa (primeras {csvAnalysis.preview.length} filas)
                      </Typography>
                      <TableContainer component={Paper} sx={{ maxHeight: 300 }}>
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>#</TableCell>
                              {csvAnalysis.headers.slice(0, 5).map((h) => (
                                <TableCell key={h}>{h}</TableCell>
                              ))}
                              {csvAnalysis.headers.length > 5 && <TableCell>...</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {csvAnalysis.preview.slice(0, 5).map((row) => (
                              <TableRow key={row.row}>
                                <TableCell>{row.row}</TableCell>
                                {csvAnalysis.headers.slice(0, 5).map((h) => (
                                  <TableCell key={h}>
                                    {String(row.input[h] || '').substring(0, 50)}
                                    {String(row.input[h] || '').length > 50 ? '...' : ''}
                                  </TableCell>
                                ))}
                                {csvAnalysis.headers.length > 5 && <TableCell>...</TableCell>}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* Step 2: Configurar Campos */}
          {activeStep === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Configurar Mapeo de Campos
              </Typography>

              <Alert severity="info" sx={{ mb: 3 }}>
                Configura cómo se mapean las columnas del CSV a los campos de Mediastream.
                Los campos marcados con * son obligatorios.
              </Alert>

              <List>
                {mappings.map((mapping, index) => (
                  <ListItem
                    key={index}
                    sx={{
                      bgcolor: 'background.default',
                      borderRadius: 2,
                      mb: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 2, width: '100%', alignItems: 'center' }}>
                      <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Tipo de Campo</InputLabel>
                        <Select
                          value={mapping.mapper}
                          label="Tipo de Campo"
                          onChange={(e) => handleMappingChange(index, 'mapper', e.target.value)}
                          size="small"
                        >
                          {availableMappers?.map((m) => (
                            <MenuItem key={m.name} value={m.name}>
                              {m.displayName}
                              {m.required && ' *'}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <FormControl sx={{ minWidth: 200, flexGrow: 1 }}>
                        <InputLabel>Columna CSV</InputLabel>
                        <Select
                          value={mapping.field}
                          label="Columna CSV"
                          onChange={(e) => handleMappingChange(index, 'field', e.target.value)}
                          size="small"
                        >
                          {csvAnalysis?.headers.map((h) => (
                            <MenuItem key={h} value={h}>
                              {h}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <IconButton onClick={() => handleRemoveMapping(index)} color="error">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </ListItem>
                ))}
              </List>

              <Button startIcon={<UploadIcon />} onClick={handleAddMapping} sx={{ mt: 2 }}>
                Agregar Campo
              </Button>

              {/* Validation messages */}
              <Box sx={{ mt: 3 }}>
                {!mappings.some((m) => m.mapper === 'id' && m.field) && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    Falta el campo obligatorio: ID Único
                  </Alert>
                )}
                {!mappings.some((m) => m.mapper === 'title' && m.field) && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    Falta el campo obligatorio: Título
                  </Alert>
                )}
                {!mappings.some(
                  (m) => (m.mapper === 'original' || m.mapper === 'rendition') && m.field
                ) && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    Falta el campo obligatorio: URL de Origen o Rendición
                  </Alert>
                )}
              </Box>
            </Box>
          )}

          {/* Step 3: Revisar */}
          {activeStep === 3 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Revisar Configuración
              </Typography>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Detalles de la Migración
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 2 }}>
                  <Typography color="text.secondary">Nombre:</Typography>
                  <Typography fontWeight="medium">{name}</Typography>

                  <Typography color="text.secondary">Estrategia:</Typography>
                  <Typography fontWeight="medium">
                    {strategy === 'transcode' ? 'Transcodificar' : 'Upload'}
                  </Typography>

                  <Typography color="text.secondary">Archivo:</Typography>
                  <Typography fontWeight="medium">{file?.name}</Typography>

                  <Typography color="text.secondary">Total de filas:</Typography>
                  <Typography fontWeight="medium">
                    {csvAnalysis?.rowCount.toLocaleString()}
                  </Typography>

                  <Typography color="text.secondary">Template:</Typography>
                  <Typography fontWeight="medium">
                    {selectedTemplate?.name || 'Ninguno'}
                  </Typography>
                </Box>
              </Paper>

              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Mapeo de Campos ({mappings.filter((m) => m.mapper && m.field).length})
                </Typography>
                <Divider sx={{ mb: 2 }} />

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Campo Mediastream</TableCell>
                        <TableCell>Columna CSV</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mappings
                        .filter((m) => m.mapper && m.field)
                        .map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {mapperOptions?.find((o) => o.name === m.mapper)?.displayName ||
                                m.mapper}
                            </TableCell>
                            <TableCell>{m.field}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>

              {/* Advanced Options */}
              <Button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                endIcon={showAdvancedOptions ? <CollapseIcon /> : <ExpandIcon />}
                sx={{ mb: 2 }}
              >
                Opciones Avanzadas
              </Button>
              <Collapse in={showAdvancedOptions}>
                <Paper sx={{ p: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={autoRetry}
                        onChange={(e) => setAutoRetry(e.target.checked)}
                      />
                    }
                    label="Reintentos automáticos para items con error"
                  />
                  <Typography variant="caption" color="text.secondary" display="block">
                    Si está habilitado, los items que fallen se reintentarán automáticamente
                    hasta 3 veces con espera exponencial.
                  </Typography>
                </Paper>
              </Collapse>
            </Box>
          )}

          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
            <Button disabled={activeStep === 0} onClick={handleBack}>
              Atrás
            </Button>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="outlined" onClick={() => navigate('/migrations')}>
                Cancelar
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!isStepValid() || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <CircularProgress size={24} />
                ) : activeStep === steps.length - 1 ? (
                  'Crear Migración'
                ) : (
                  'Siguiente'
                )}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
