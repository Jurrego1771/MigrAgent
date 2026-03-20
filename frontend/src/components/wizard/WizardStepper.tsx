import { Box, Typography, alpha } from '@mui/material';
import { CheckRounded as CheckIcon } from '@mui/icons-material';
import { useWizard, WizardStepDef } from '../../context/WizardContext';
import { COLORS } from '../../theme';

interface StepNodeProps {
  step: WizardStepDef;
  isActive: boolean;
  isComplete: boolean;
  isAccessible: boolean;
  isLast: boolean;
  onClick: () => void;
}

function StepNode({ step, isActive, isComplete, isAccessible, isLast, onClick }: StepNodeProps) {
  const canClick = isAccessible && !isActive;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <Box
        onClick={canClick ? onClick : undefined}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1.25,
          borderRadius: 2,
          cursor: canClick ? 'pointer' : 'default',
          width: '100%',
          transition: 'all 0.18s ease',
          background: isActive
            ? alpha(COLORS.neonGreen, 0.1)
            : 'transparent',
          border: isActive
            ? `1px solid ${alpha(COLORS.neonGreen, 0.3)}`
            : '1px solid transparent',
          '&:hover': canClick ? {
            background: alpha(COLORS.charcoal, 0.35),
          } : {},
        }}
      >
        {/* Número / check */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            transition: 'all 0.18s ease',
            ...(isComplete
              ? {
                  background: COLORS.neonGreen,
                  color: '#0A1A0A',
                  boxShadow: `0 0 10px ${alpha(COLORS.neonGreen, 0.5)}`,
                }
              : isActive
              ? {
                  background: alpha(COLORS.neonGreen, 0.15),
                  border: `2px solid ${COLORS.neonGreen}`,
                  color: COLORS.neonGreen,
                  boxShadow: `0 0 12px ${alpha(COLORS.neonGreen, 0.3)}`,
                }
              : {
                  background: alpha(COLORS.charcoal, 0.3),
                  border: `1px solid ${alpha(COLORS.charcoal, 0.8)}`,
                  color: isAccessible ? 'text.secondary' : 'text.disabled',
                }),
          }}
        >
          {isComplete ? <CheckIcon sx={{ fontSize: 16 }} /> : step.id}
        </Box>

        {/* Labels */}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontSize: '0.8rem',
              fontWeight: isActive ? 700 : 500,
              color: isActive
                ? COLORS.neonGreen
                : isComplete
                ? 'text.primary'
                : isAccessible
                ? 'text.secondary'
                : 'text.disabled',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {step.label}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              fontSize: '0.68rem',
              color: isActive ? alpha(COLORS.neonGreen, 0.7) : 'text.disabled',
              display: 'block',
              mt: 0.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {step.description}
          </Typography>
        </Box>
      </Box>

      {/* Conector vertical */}
      {!isLast && (
        <Box
          sx={{
            ml: '30px', // alinea con el centro del círculo (px:2 + 32/2 ≈ 16+16=32)
            width: 2,
            height: 20,
            background: isComplete
              ? alpha(COLORS.neonGreen, 0.4)
              : alpha(COLORS.charcoal, 0.5),
            borderRadius: 1,
            my: 0.25,
            transition: 'background 0.3s ease',
          }}
        />
      )}
    </Box>
  );
}

export default function WizardStepper() {
  const { steps, currentStep, isStepComplete, isStepAccessible, goToStep } = useWizard();

  return (
    <Box
      sx={{
        width: 220,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        pt: 1,
        pb: 2,
      }}
    >
      {/* Header */}
      <Box sx={{ px: 2, mb: 3 }}>
        <Typography
          variant="caption"
          sx={{
            color: 'text.disabled',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontSize: '0.65rem',
            fontWeight: 700,
          }}
        >
          Pasos
        </Typography>
      </Box>

      {steps.map((step, i) => (
        <StepNode
          key={step.id}
          step={step}
          isActive={currentStep === step.id}
          isComplete={isStepComplete(step.id)}
          isAccessible={isStepAccessible(step.id)}
          isLast={i === steps.length - 1}
          onClick={() => goToStep(step.id)}
        />
      ))}
    </Box>
  );
}
