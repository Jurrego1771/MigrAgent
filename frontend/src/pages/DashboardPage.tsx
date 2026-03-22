import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Button,
  Chip,
  alpha,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  CheckCircle as DoneIcon,
  Error as ErrorIcon,
  PlayArrow as RunningIcon,
  AllInclusive as TotalIcon,
  TrendingUp as RateIcon,
  Visibility as ViewIcon,
  BookmarkBorder as TemplateIcon,
} from '@mui/icons-material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { dashboardApi } from '../services/api';
import { COLORS } from '../theme';

// ── Status config ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  created: 'Creada',
  validating: 'Validando',
  validated: 'Validada',
  running: 'En progreso',
  paused: 'Pausada',
  done: 'Completada',
  error: 'Error',
};

const STATUS_COLOR: Record<string, string> = {
  created: COLORS.charcoal,
  validating: '#64b5f6',
  validated: COLORS.sageGreen,
  running: COLORS.neonGreen,
  paused: COLORS.dustyRose,
  done: COLORS.sageGreen,
  error: COLORS.alertRed,
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <Box
      sx={{
        border: `1px solid ${alpha(color, 0.35)}`,
        borderRadius: 3,
        p: 2.5,
        background: alpha(COLORS.darkCard, 0.6),
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexGrow: 1,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          background: alpha(color, 0.12),
          border: `1px solid ${alpha(color, 0.3)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography variant="caption" color="text.disabled" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.65rem', fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.1, color }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.7rem' }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ── Activity Chart ────────────────────────────────────────────────────────────

function ActivityChart({ data }: { data: Array<{ date: string; created: number; completed: number }> }) {
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date + 'T12:00:00').toLocaleDateString('es', { weekday: 'short', day: 'numeric' }),
  }));

  return (
    <Box
      sx={{
        border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
        borderRadius: 3,
        p: 2.5,
        background: alpha(COLORS.darkCard, 0.5),
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem', fontWeight: 700, display: 'block', mb: 2 }}>
        Actividad — últimos 7 días
      </Typography>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={formatted} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.neonGreen} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.neonGreen} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.sageGreen} stopOpacity={0.25} />
              <stop offset="95%" stopColor={COLORS.sageGreen} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={alpha(COLORS.darkBorder, 0.4)} />
          <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#888', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
          <RechartTooltip
            contentStyle={{ background: COLORS.darkCard, border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#ccc', marginBottom: 4 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: '#888', paddingTop: 8 }} />
          <Area type="monotone" dataKey="created" name="Creadas" stroke={COLORS.neonGreen} strokeWidth={2} fill="url(#gradCreated)" dot={false} />
          <Area type="monotone" dataKey="completed" name="Completadas" stroke={COLORS.sageGreen} strokeWidth={2} fill="url(#gradCompleted)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}

// ── Recent Migrations ─────────────────────────────────────────────────────────

function RecentMigrations({
  items,
  onView,
}: {
  items: Array<{ id: string; name: string; status: string; processedItems: number; totalItems: number; errorItems: number; createdAt: string; strategy: string }>;
  onView: (id: string) => void;
}) {
  return (
    <Box
      sx={{
        border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
        borderRadius: 3,
        p: 2.5,
        background: alpha(COLORS.darkCard, 0.5),
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem', fontWeight: 700, display: 'block', mb: 2 }}>
        Migraciones recientes
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {items.map((m) => {
          const progress = m.totalItems > 0 ? Math.round((m.processedItems / m.totalItems) * 100) : 0;
          const color = STATUS_COLOR[m.status] || COLORS.charcoal;
          return (
            <Box
              key={m.id}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                borderRadius: 2,
                border: `1px solid ${alpha(COLORS.darkBorder, 0.6)}`,
                background: alpha(COLORS.darkCard, 0.4),
                cursor: 'pointer',
                '&:hover': { background: alpha(COLORS.charcoal, 0.3) },
              }}
              onClick={() => onView(m.id)}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color,
                  flexShrink: 0,
                  boxShadow: m.status === 'running' ? `0 0 6px ${color}` : 'none',
                }}
              />
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={500} noWrap sx={{ fontSize: '0.82rem' }}>
                  {m.name}
                </Typography>
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
                  {m.processedItems.toLocaleString()} / {m.totalItems.toLocaleString()} items
                  {m.errorItems > 0 && ` · ${m.errorItems} errores`}
                  {m.status !== 'created' && m.status !== 'validated' && ` · ${progress}%`}
                </Typography>
              </Box>
              <Chip
                label={STATUS_LABEL[m.status] || m.status}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  bgcolor: alpha(color, 0.12),
                  color,
                  border: `1px solid ${alpha(color, 0.3)}`,
                  flexShrink: 0,
                }}
              />
              <Tooltip title="Ver detalle">
                <ViewIcon sx={{ fontSize: 16, color: 'text.disabled', flexShrink: 0 }} />
              </Tooltip>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ── Top Templates ─────────────────────────────────────────────────────────────

function TopTemplates({ items }: { items: Array<{ id: string; name: string; usageCount: number; strategy: string }> }) {
  if (!items.length) return null;
  return (
    <Box
      sx={{
        border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
        borderRadius: 3,
        p: 2.5,
        background: alpha(COLORS.darkCard, 0.5),
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.disabled', textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.65rem', fontWeight: 700, display: 'block', mb: 2 }}>
        Templates más usados
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {items.map((t) => (
          <Box
            key={t.id}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.25,
              py: 0.75,
              borderRadius: 2,
              border: `1px solid ${alpha(COLORS.darkBorder, 0.5)}`,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TemplateIcon sx={{ fontSize: 14, color: 'text.disabled' }} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
                {t.name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip
                label={t.strategy === 'transcode' ? 'Transcode' : 'Upload'}
                size="small"
                sx={{ height: 16, fontSize: '0.6rem', bgcolor: alpha(COLORS.charcoal, 0.4), color: 'text.disabled' }}
              />
              <Typography variant="caption" color="text.disabled" sx={{ minWidth: 40, textAlign: 'right' }}>
                {t.usageCount}× usado
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: dashboardApi.getMetrics,
    refetchInterval: 30_000,
  });

  const activeMigrations = (metrics?.byStatus?.running || 0) + (metrics?.byStatus?.validating || 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Vista general de tus migraciones
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/migrations/new')}
          sx={{ fontWeight: 700 }}
        >
          Nueva Migración
        </Button>
      </Box>

      {/* Error */}
      {error && (
        <Alert severity="error" sx={{ fontSize: '0.82rem' }}>
          No se pudieron cargar las métricas.
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} sx={{ color: COLORS.neonGreen }} />
        </Box>
      )}

      {metrics && (
        <>
          {/* Stat cards */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <StatCard
              label="Total migraciones"
              value={metrics.totalMigrations}
              icon={<TotalIcon fontSize="small" />}
              color={COLORS.neonGreen}
            />
            <StatCard
              label="Activas ahora"
              value={activeMigrations}
              sub={`${metrics.byStatus?.paused || 0} pausadas`}
              icon={<RunningIcon fontSize="small" />}
              color="#64b5f6"
            />
            <StatCard
              label="Completadas"
              value={metrics.byStatus?.done || 0}
              sub={`${metrics.totalItemsMigrated.toLocaleString()} items migrados`}
              icon={<DoneIcon fontSize="small" />}
              color={COLORS.sageGreen}
            />
            <StatCard
              label="Con errores"
              value={metrics.byStatus?.error || 0}
              sub={`${metrics.totalItemsWithErrors.toLocaleString()} items fallidos`}
              icon={<ErrorIcon fontSize="small" />}
              color={COLORS.alertRed}
            />
            {metrics.successRate !== null && (
              <StatCard
                label="Tasa de éxito"
                value={`${metrics.successRate}%`}
                sub="items completados vs fallidos"
                icon={<RateIcon fontSize="small" />}
                color={metrics.successRate >= 90 ? COLORS.sageGreen : metrics.successRate >= 70 ? COLORS.dustyRose : COLORS.alertRed}
              />
            )}
          </Box>

          {/* Activity chart */}
          <ActivityChart data={metrics.activity} />

          {/* Bottom grid */}
          <Box sx={{ display: 'flex', gap: 2.5, flexWrap: 'wrap' }}>
            {/* Recent migrations */}
            <Box sx={{ flexGrow: 1, minWidth: 300 }}>
              {metrics.recentMigrations.length > 0 ? (
                <RecentMigrations
                  items={metrics.recentMigrations}
                  onView={(id) => navigate(`/migrations/${id}`)}
                />
              ) : (
                <Box
                  sx={{
                    border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
                    borderRadius: 3,
                    p: 4,
                    textAlign: 'center',
                    background: alpha(COLORS.darkCard, 0.5),
                  }}
                >
                  <Typography color="text.disabled" gutterBottom>
                    No hay migraciones aún
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => navigate('/migrations/new')}>
                    Crear la primera
                  </Button>
                </Box>
              )}
            </Box>

            {/* Top templates */}
            {metrics.topTemplates.length > 0 && (
              <Box sx={{ flexShrink: 0, width: { xs: '100%', md: 300 } }}>
                <TopTemplates items={metrics.topTemplates} />
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
