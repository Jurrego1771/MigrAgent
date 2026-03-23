import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SessionInfo, AccountValidationState, CSVWizardState, MappingConfig, ExtraColumn, URLValidationWizardState, TransformationRule } from '../types';

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

  // Step 2 — Account
  accountValidation: AccountValidationState;

  // Step 3 — CSV
  csvStep: CSVWizardState;

  // Step 4 — URL Validation
  urlValidation: URLValidationWizardState;
}

const DEFAULT_CSV_STATE: CSVWizardState = {
  tempFile: null,
  mappings: [],
  extraColumns: [],
  normalizedTempId: null,
  transformationRules: [],
  templateId: null,
  historyDuplicates: null,
  skipHistoryDuplicates: false,
  internalDuplicates: null,
  cleanCsv: false,
};

const DEFAULT_URL_VALIDATION: URLValidationWizardState = {
  status: 'idle',
  summary: null,
  results: [],
  checkedAt: null,
};

const DEFAULT_ACCOUNT_VALIDATION: AccountValidationState = {
  accountInfo: null,
  renditionsInfo: null,
  contentType: null,
  hasAdvertising: null,
  suggestCategoryField: false,
  migrationName: '',
  migrationStrategy: 'transcode',
};

interface WizardContextValue extends WizardState {
  steps: WizardStepDef[];
  goNext: () => void;
  goBack: () => void;
  goToStep: (step: number) => void;
  markStepComplete: (step: number) => void;
  setSession: (session: SessionInfo | null) => void;
  setAccountValidation: (update: Partial<AccountValidationState>) => void;
  setCsvStep: (update: Partial<CSVWizardState>) => void;
  setMappings: (mappings: MappingConfig[]) => void;
  setExtraColumns: (cols: ExtraColumn[]) => void;
  setTransformationRules: (rules: TransformationRule[]) => void;
  setSkipHistoryDuplicates: (skip: boolean) => void;
  setCleanCsv: (clean: boolean) => void;
  setUrlValidation: (update: Partial<URLValidationWizardState>) => void;
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
  const [accountValidation, setAccountValidationState] = useState<AccountValidationState>(
    DEFAULT_ACCOUNT_VALIDATION
  );
  const [csvStep, setCsvStepState] = useState<CSVWizardState>(DEFAULT_CSV_STATE);
  const [urlValidation, setUrlValidationState] = useState<URLValidationWizardState>(DEFAULT_URL_VALIDATION);

  const setAccountValidation = useCallback((update: Partial<AccountValidationState>) => {
    setAccountValidationState((prev) => ({ ...prev, ...update }));
  }, []);

  const setCsvStep = useCallback((update: Partial<CSVWizardState>) => {
    setCsvStepState((prev) => ({ ...prev, ...update }));
  }, []);

  const setMappings = useCallback((mappings: MappingConfig[]) => {
    setCsvStepState((prev) => ({ ...prev, mappings }));
  }, []);

  const setExtraColumns = useCallback((cols: ExtraColumn[]) => {
    setCsvStepState((prev) => ({ ...prev, extraColumns: cols }));
  }, []);

  const setTransformationRules = useCallback((rules: TransformationRule[]) => {
    setCsvStepState((prev) => ({ ...prev, transformationRules: rules }));
  }, []);

  const setSkipHistoryDuplicates = useCallback((skip: boolean) => {
    setCsvStepState((prev) => ({ ...prev, skipHistoryDuplicates: skip }));
  }, []);

  const setCleanCsv = useCallback((clean: boolean) => {
    setCsvStepState((prev) => ({ ...prev, cleanCsv: clean }));
  }, []);

  const setUrlValidation = useCallback((update: Partial<URLValidationWizardState>) => {
    setUrlValidationState((prev) => ({ ...prev, ...update }));
  }, []);

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
      case 2:
        return (
          !!accountValidation.contentType &&
          accountValidation.hasAdvertising !== null &&
          accountValidation.migrationName.trim().length > 0
        );
      case 3: {
        const { tempFile, mappings } = csvStep;
        if (!tempFile) return false;
        const hasId = mappings.some((m) => m.mapper === 'id');
        const hasTitle = mappings.some((m) => m.mapper === 'title');
        const hasUrl =
          mappings.some((m) => m.mapper === 'original') ||
          mappings.some((m) => m.mapper === 'rendition');
        return hasId && hasTitle && hasUrl;
      }
      case 4:
        return urlValidation.status === 'done';
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
        accountValidation,
        csvStep,
        urlValidation,
        goNext,
        goBack,
        goToStep,
        markStepComplete,
        setSession,
        setAccountValidation,
        setCsvStep,
        setMappings,
        setExtraColumns,
        setTransformationRules,
        setSkipHistoryDuplicates,
        setCleanCsv,
        setUrlValidation,
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
