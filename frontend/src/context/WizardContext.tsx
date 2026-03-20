import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SessionInfo } from '../types';

// ---------------------------------------------------------------------------
// Definición de pasos
// ---------------------------------------------------------------------------

export interface WizardStepDef {
  id: number;
  label: string;
  description: string;
  icon: string; // emoji para simplificar, se puede cambiar por MUI icon
}

export const WIZARD_STEPS: WizardStepDef[] = [
  { id: 1, label: 'Autenticación',    description: 'Conectar con Mediastream',         icon: '🔑' },
  { id: 2, label: 'Cuenta',           description: 'Validar módulos y rendiciones',     icon: '🏢' },
  { id: 3, label: 'Archivo CSV',      description: 'Cargar y mapear campos',            icon: '📄' },
  { id: 4, label: 'Validar URLs',     description: 'Verificar accesibilidad y calidad', icon: '🔍' },
  { id: 5, label: 'Informe',          description: 'Resumen de validación',             icon: '📊' },
  { id: 6, label: 'Confirmar',        description: 'Crear migración en SM2',            icon: '🚀' },
];

// ---------------------------------------------------------------------------
// Estado compartido del wizard
// ---------------------------------------------------------------------------

export interface WizardState {
  // Navegación
  currentStep: number;
  completedSteps: Set<number>;

  // Step 1 — Auth
  session: SessionInfo | null;

  // Step 2 — Account (pendiente)
  // Step 3 — CSV (pendiente)
  // Step 4-5 — Validation (pendiente)
  // Step 6 — Submit (pendiente)
}

interface WizardContextValue extends WizardState {
  steps: WizardStepDef[];
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: number) => void;
  markStepComplete: (step: number) => void;
  setSession: (session: SessionInfo | null) => void;
  canGoNext: boolean;
  isStepComplete: (step: number) => boolean;
  isStepAccessible: (step: number) => boolean;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WizardContext = createContext<WizardContextValue | null>(null);

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [session, setSession] = useState<SessionInfo | null>(null);

  const markStepComplete = useCallback((step: number) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < WIZARD_STEPS.length) {
      markStepComplete(currentStep);
      setCurrentStep((s) => s + 1);
    }
  }, [currentStep, markStepComplete]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      // Solo permite ir a pasos accesibles (completados o el actual)
      if (step >= 1 && step <= WIZARD_STEPS.length && (completedSteps.has(step - 1) || step === 1 || completedSteps.has(step))) {
        setCurrentStep(step);
      }
    },
    [completedSteps]
  );

  const isStepComplete = useCallback(
    (step: number) => completedSteps.has(step),
    [completedSteps]
  );

  const isStepAccessible = useCallback(
    (step: number) => step === 1 || completedSteps.has(step - 1) || completedSteps.has(step),
    [completedSteps]
  );

  // Lógica de "puede continuar" por paso
  const canGoNext: boolean = (() => {
    switch (currentStep) {
      case 1: return session !== null;
      default: return true;
    }
  })();

  return (
    <WizardContext.Provider
      value={{
        currentStep,
        completedSteps,
        steps: WIZARD_STEPS,
        session,
        goNext,
        goBack,
        goToStep,
        markStepComplete,
        setSession,
        canGoNext,
        isStepComplete,
        isStepAccessible,
      }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard debe usarse dentro de WizardProvider');
  return ctx;
}
