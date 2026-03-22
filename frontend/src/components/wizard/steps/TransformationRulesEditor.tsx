import { useState } from 'react';
import {
  Box, Typography, Button, IconButton, Select, MenuItem,
  TextField, Switch, alpha, Chip,
  Collapse, Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Transform as TransformIcon,
} from '@mui/icons-material';
import { v4 as uuidv4 } from 'uuid';
import { TransformationRule, TransformationRuleType } from '../../../types';
import { COLORS } from '../../../theme';

// ---------------------------------------------------------------------------
// Labels por tipo de regla
// ---------------------------------------------------------------------------

const RULE_TYPE_LABELS: Record<TransformationRuleType, string> = {
  trim:      'Recortar espacios',
  uppercase: 'Mayúsculas',
  lowercase: 'Minúsculas',
  replace:   'Reemplazar texto',
  regex:     'Reemplazar con regex',
  prefix:    'Agregar prefijo',
  suffix:    'Agregar sufijo',
  default:   'Valor por defecto (si vacío)',
  truncate:  'Truncar a N caracteres',
  map_value: 'Mapear valor (A → B)',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface Props {
  rules: TransformationRule[];
  csvHeaders: string[];
  onChange: (rules: TransformationRule[]) => void;
}

// ---------------------------------------------------------------------------
// Fila de regla individual
// ---------------------------------------------------------------------------

function RuleRow({
  rule,
  csvHeaders,
  onUpdate,
  onDelete,
}: {
  rule: TransformationRule;
  csvHeaders: string[];
  onUpdate: (updated: TransformationRule) => void;
  onDelete: () => void;
}) {
  const set = (patch: Partial<TransformationRule>) => onUpdate({ ...rule, ...patch });

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: '1fr 180px 1fr auto',
        gap: 1,
        alignItems: 'flex-start',
        p: 1.25,
        borderRadius: 1.5,
        border: `1px solid ${alpha(rule.enabled ? COLORS.neonGreen : COLORS.charcoal, 0.2)}`,
        background: alpha(rule.enabled ? COLORS.neonGreen : COLORS.charcoal, 0.04),
      }}
    >
      {/* Campo CSV */}
      <Select
        value={rule.field}
        onChange={(e) => set({ field: e.target.value })}
        size="small"
        displayEmpty
        sx={{ fontSize: '0.82rem' }}
      >
        <MenuItem value=""><em>Campo…</em></MenuItem>
        {csvHeaders.map((h) => (
          <MenuItem key={h} value={h} sx={{ fontSize: '0.82rem' }}>{h}</MenuItem>
        ))}
      </Select>

      {/* Tipo de regla */}
      <Select
        value={rule.type}
        onChange={(e) => set({ type: e.target.value as TransformationRuleType })}
        size="small"
        sx={{ fontSize: '0.82rem' }}
      >
        {(Object.keys(RULE_TYPE_LABELS) as TransformationRuleType[]).map((t) => (
          <MenuItem key={t} value={t} sx={{ fontSize: '0.82rem' }}>{RULE_TYPE_LABELS[t]}</MenuItem>
        ))}
      </Select>

      {/* Parámetros según tipo */}
      <RuleParams rule={rule} onUpdate={onUpdate} />

      {/* Acciones */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={rule.enabled ? 'Deshabilitar' : 'Habilitar'}>
          <Switch
            size="small"
            checked={rule.enabled}
            onChange={(e) => set({ enabled: e.target.checked })}
          />
        </Tooltip>
        <Tooltip title="Eliminar regla">
          <IconButton size="small" onClick={onDelete} sx={{ color: 'text.disabled' }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

function RuleParams({
  rule,
  onUpdate,
}: {
  rule: TransformationRule;
  onUpdate: (updated: TransformationRule) => void;
}) {
  const set = (patch: Partial<TransformationRule>) => onUpdate({ ...rule, ...patch });

  switch (rule.type) {
    case 'trim':
    case 'uppercase':
    case 'lowercase':
      return <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
          Sin parámetros
        </Typography>
      </Box>;

    case 'replace':
      return (
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            placeholder="Buscar…"
            value={rule.find ?? ''}
            onChange={(e) => set({ find: e.target.value })}
            sx={{ flex: 1, fontSize: '0.82rem' }}
            inputProps={{ style: { fontSize: '0.82rem' } }}
          />
          <TextField
            size="small"
            placeholder="Reemplazar con…"
            value={rule.replace ?? ''}
            onChange={(e) => set({ replace: e.target.value })}
            sx={{ flex: 1, fontSize: '0.82rem' }}
            inputProps={{ style: { fontSize: '0.82rem' } }}
          />
        </Box>
      );

    case 'regex':
      return (
        <Box sx={{ display: 'flex', gap: 0.75 }}>
          <TextField
            size="small"
            placeholder="/patrón/g"
            value={rule.find ?? ''}
            onChange={(e) => set({ find: e.target.value })}
            sx={{ flex: 1, fontSize: '0.82rem', fontFamily: 'monospace' }}
            inputProps={{ style: { fontSize: '0.82rem', fontFamily: 'monospace' } }}
          />
          <TextField
            size="small"
            placeholder="Reemplazo ($1…)"
            value={rule.replace ?? ''}
            onChange={(e) => set({ replace: e.target.value })}
            sx={{ flex: 1, fontSize: '0.82rem' }}
            inputProps={{ style: { fontSize: '0.82rem' } }}
          />
        </Box>
      );

    case 'prefix':
    case 'suffix':
      return (
        <TextField
          size="small"
          placeholder={rule.type === 'prefix' ? 'Prefijo a agregar…' : 'Sufijo a agregar…'}
          value={rule.value ?? ''}
          onChange={(e) => set({ value: e.target.value })}
          fullWidth
          inputProps={{ style: { fontSize: '0.82rem' } }}
        />
      );

    case 'default':
      return (
        <TextField
          size="small"
          placeholder="Valor por defecto…"
          value={rule.value ?? ''}
          onChange={(e) => set({ value: e.target.value })}
          fullWidth
          inputProps={{ style: { fontSize: '0.82rem' } }}
        />
      );

    case 'truncate':
      return (
        <TextField
          size="small"
          type="number"
          placeholder="Máx. caracteres"
          value={rule.value ?? ''}
          onChange={(e) => set({ value: e.target.value })}
          fullWidth
          inputProps={{ style: { fontSize: '0.82rem' }, min: 1, max: 10000 }}
        />
      );

    case 'map_value': {
      const table = rule.mappingTable ?? {};
      const pairs = Object.entries(table);
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {pairs.map(([from, to], idx) => (
            <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Desde"
                value={from}
                onChange={(e) => {
                  const newTable = { ...table };
                  delete newTable[from];
                  newTable[e.target.value] = to;
                  set({ mappingTable: newTable });
                }}
                sx={{ flex: 1 }}
                inputProps={{ style: { fontSize: '0.75rem' } }}
              />
              <Typography variant="caption" color="text.disabled">→</Typography>
              <TextField
                size="small"
                placeholder="Hacia"
                value={to}
                onChange={(e) => {
                  const newTable = { ...table, [from]: e.target.value };
                  set({ mappingTable: newTable });
                }}
                sx={{ flex: 1 }}
                inputProps={{ style: { fontSize: '0.75rem' } }}
              />
              <IconButton
                size="small"
                onClick={() => {
                  const newTable = { ...table };
                  delete newTable[from];
                  set({ mappingTable: newTable });
                }}
              >
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Box>
          ))}
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => set({ mappingTable: { ...table, '': '' } })}
            sx={{ alignSelf: 'flex-start', fontSize: '0.72rem', color: 'text.secondary' }}
          >
            Agregar par
          </Button>
        </Box>
      );
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export default function TransformationRulesEditor({ rules, csvHeaders, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const addRule = () => {
    onChange([
      ...rules,
      {
        id: uuidv4(),
        field: csvHeaders[0] ?? '',
        type: 'trim',
        enabled: true,
      },
    ]);
    setOpen(true);
  };

  const updateRule = (id: string, updated: TransformationRule) => {
    onChange(rules.map((r) => (r.id === id ? updated : r)));
  };

  const deleteRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  const activeCount = rules.filter((r) => r.enabled).length;

  return (
    <Box
      sx={{
        border: `1px solid ${alpha(COLORS.charcoal, 0.5)}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Header colapsable */}
      <Box
        sx={{
          px: 2, py: 1.25,
          background: alpha(COLORS.charcoal, 0.15),
          display: 'flex', alignItems: 'center', gap: 1,
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setOpen((v) => !v)}
      >
        <TransformIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
        <Typography
          variant="caption"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'text.disabled', flexGrow: 1 }}
        >
          Reglas de transformación
        </Typography>
        {activeCount > 0 && (
          <Chip
            label={`${activeCount} activa${activeCount !== 1 ? 's' : ''}`}
            size="small"
            sx={{
              height: 18, fontSize: '0.65rem', fontWeight: 700,
              bgcolor: alpha(COLORS.neonGreen, 0.15),
              color: COLORS.neonGreen,
              border: `1px solid ${alpha(COLORS.neonGreen, 0.3)}`,
            }}
          />
        )}
        {open ? (
          <CollapseIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        ) : (
          <ExpandIcon sx={{ fontSize: 18, color: 'text.disabled' }} />
        )}
      </Box>

      <Collapse in={open}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            Las reglas se aplican al CSV normalizado antes de enviarlo a SM2.
            Se ejecutan en orden, campo a campo.
          </Typography>

          {rules.length === 0 ? (
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: 'italic' }}>
              Sin reglas configuradas — los datos se migran tal como están.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {rules.map((rule) => (
                <RuleRow
                  key={rule.id}
                  rule={rule}
                  csvHeaders={csvHeaders}
                  onUpdate={(updated) => updateRule(rule.id, updated)}
                  onDelete={() => deleteRule(rule.id)}
                />
              ))}
            </Box>
          )}

          <Button
            variant="outlined"
            size="small"
            startIcon={<AddIcon />}
            onClick={addRule}
            sx={{
              alignSelf: 'flex-start',
              borderColor: alpha(COLORS.charcoal, 0.5),
              color: 'text.secondary',
              fontSize: '0.8rem',
            }}
          >
            Agregar regla
          </Button>
        </Box>
      </Collapse>
    </Box>
  );
}
