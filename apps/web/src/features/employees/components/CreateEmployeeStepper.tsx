interface StepItem {
  number: number;
  label: string;
  subtitle: string;
}

const STEPS: StepItem[] = [
  { number: 1, label: 'Personal', subtitle: 'Name & Contact' },
  { number: 2, label: 'Employment', subtitle: 'Role & Department' },
  { number: 3, label: 'Access', subtitle: 'Role & Review' },
];

export interface CreateEmployeeStepperProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function CreateEmployeeStepper({
  currentStep,
  onStepClick,
  className = '',
}: CreateEmployeeStepperProps) {
  return (
    <nav aria-label="Employee Creation Progress" className={`w-full ${className}`}>
      {/* Mobile view (< 640px): Compact progress pill with step count */}
      <div className="flex sm:hidden items-center justify-between bg-surface-muted border border-border p-3 rounded-card">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary-deep text-white font-bold text-xs">
            {currentStep}
          </span>
          <div>
            <p className="text-xs font-semibold text-text">
              Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1]?.label}
            </p>
            <p className="text-[11px] text-text-muted">{STEPS[currentStep - 1]?.subtitle}</p>
          </div>
        </div>
        <div className="flex gap-1">
          {STEPS.map((s) => (
            <div
              key={s.number}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                s.number === currentStep
                  ? 'bg-primary-deep'
                  : s.number < currentStep
                    ? 'bg-primary-strong'
                    : 'bg-border-strong'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop / Tablet view (>= 640px): Expanded visual stepper */}
      <ol className="hidden sm:grid grid-cols-3 gap-3">
        {STEPS.map((step) => {
          const isCurrent = step.number === currentStep;
          const isCompleted = step.number < currentStep;

          return (
            <li key={step.number} className="relative">
              <button
                type="button"
                disabled={!onStepClick || step.number > currentStep}
                onClick={() => onStepClick?.(step.number)}
                aria-current={isCurrent ? 'step' : undefined}
                className={`w-full text-left p-3.5 rounded-card border transition-all flex items-center gap-3 select-none ${
                  isCurrent
                    ? 'bg-primary-soft border-primary-strong shadow-raised'
                    : isCompleted
                      ? 'bg-surface border-border hover:bg-surface-muted cursor-pointer'
                      : 'bg-surface-muted border-border/70 opacity-60 cursor-default'
                }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-primary-deep text-white'
                      : isCompleted
                        ? 'bg-primary-strong text-white'
                        : 'bg-border text-text-muted'
                  }`}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4 stroke-current stroke-2 fill-none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </div>
                <div className="min-w-0">
                  <p
                    className={`text-xs font-bold truncate ${
                      isCurrent ? 'text-primary-ink' : 'text-text'
                    }`}
                  >
                    {step.label}
                  </p>
                  <p className="text-[11px] text-text-muted truncate">{step.subtitle}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
