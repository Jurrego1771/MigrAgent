import { Box, Typography, Button, alpha, Chip } from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { WizardProvider, useWizard, WIZARD_STEPS } from '../context/WizardContext';
import WizardStepper from '../components/wizard/WizardStepper';
import AuthStep from '../components/wizard/steps/AuthStep';
import { COLORS } from '../theme';

// ---------------------------------------------------------------------------
// Contenido por paso
// ---------------------------------------------------------------------------

function StepContent() {
  const { currentStep } = useWizard();

  switch (currentStep) {
    case 1: return <AuthStep />;
    case 2: return <PlaceholderStep stepId={2} />;
    case 3: return <PlaceholderStep stepId={3} />;
    case 4: return <PlaceholderStep stepId={4} />;
    case 5: return <PlaceholderStep stepId={5} />;
    case 6: return <PlaceholderStep stepId={6} />;
    default: return null;
  }
}

function PlaceholderStep({ stepId }: { stepId: number }) {
  const step = WIZARD_STEPS.find((s) => s.id === stepId)!;
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 8,
        gap: 2,
        opacity: 0.5,
      }}
    >
      <Typography sx={{ fontSize: '3rem' }}>{step.icon}</Typography>
      <Typography variant="h6" color="text.secondary">
        {step.label} — próximamente
      </Typography>
      <Typography variant="body2" color="text.disabled">
        {step.description}
      </Typography>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Layout interno del wizard
// ---------------------------------------------------------------------------

function WizardLayout() {
  const navigate = useNavigate();
  const { currentStep, steps, goNext, goBack, canGoNext } = useWizard();
  const isFirst = currentStep === 1;
  const isLast = currentStep === steps.length;
  const currentStepDef = steps[currentStep - 1];

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 'calc(100vh - 128px)',
      }}
    >
      {/* Topbar del wizard */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: alpha(COLORS.neonGreen, 0.12),
              border: `1px solid ${alpha(COLORS.neonGreen, 0.35)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
            }}
          >
            {currentStepDef.icon}
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Asistente de Migración
            </Typography>
            <Typography variant="caption" color="text.disabled">
              Paso {currentStep} de {steps.length} · {currentStepDef.description}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {/* Progreso compacto */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {steps.map((s) => (
              <Box
                key={s.id}
                sx={{
                  width: s.id === currentStep ? 20 : 6,
                  height: 6,
                  borderRadius: 3,
                  transition: 'all 0.3s ease',
                  background:
                    s.id < currentStep
                      ? COLORS.neonGreen
                      : s.id === currentStep
                      ? alpha(COLORS.neonGreen, 0.7)
                      : alpha(COLORS.charcoal, 0.6),
                }}
              />
            ))}
          </Box>

          <Button
            size="small"
            onClick={() => navigate('/migrations')}
            startIcon={<CloseIcon fontSize="small" />}
            sx={{ color: 'text.disabled', '&:hover': { color: 'text.secondary' } }}
          >
            Salir
          </Button>
        </Box>
      </Box>

      {/* Cuerpo: stepper + contenido */}
      <Box sx={{ display: 'flex', gap: 3, flexGrow: 1, minHeight: 0 }}>
        {/* Stepper lateral */}
        <Box
          sx={{
            flexShrink: 0,
            borderRight: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
            pr: 2,
          }}
        >
          <WizardStepper />
        </Box>

        {/* Contenido del paso */}
        <Box
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
          }}
        >
          {/* Card del paso */}
          <Box
            sx={{
              flexGrow: 1,
              p: 3,
              borderRadius: 3,
              border: `1px solid ${alpha(COLORS.darkBorder, 0.8)}`,
              background: alpha(COLORS.darkCard, 0.6),
              backdropFilter: 'blur(8px)',
              mb: 2.5,
              overflowY: 'auto',
            }}
          >
            <StepContent />
          </Box>

          {/* Navegación */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              pt: 1.5,
              borderTop: `1px solid ${alpha(COLORS.darkBorder, 0.6)}`,
            }}
          >
            {/* Atrás */}
            <Button
              variant="text"
              onClick={goBack}
              disabled={isFirst}
              startIcon={<ArrowBackIcon />}
              sx={{ color: 'text.secondary' }}
            >
              Atrás
            </Button>

            {/* Centro: step label */}
            <Chip
              label={currentStepDef.label}
              size="small"
              sx={{
                background: alpha(COLORS.charcoal, 0.3),
                color: 'text.disabled',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            />

            {/* Continuar / Finalizar */}
            <Button
              variant="contained"
              onClick={isLast ? () => navigate('/migrations') : goNext}
              disabled={!canGoNext}
              endIcon={!isLast && <ArrowForwardIcon />}
              sx={{ fontWeight: 700, px: 3 }}
            >
              {isLast ? 'Finalizar' : 'Continuar'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Export con provider
// ---------------------------------------------------------------------------

export default function MigrationWizardPage() {
  return (
    <WizardProvider>
      <WizardLayout />
    </WizardProvider>
  );
}

