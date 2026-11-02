import type { OnboardingStep } from '../types/onboarding';

export interface OnboardingStepBadgeProps {
  step: OnboardingStep;
  className?: string;
}

interface StepConfig {
  label: string;
  className: string;
  icon: JSX.Element;
}

const STEP_CONFIGS: Record<OnboardingStep, StepConfig> = {
  hr: {
    label: 'HR Setup',
    className: 'bg-primary-soft text-primary-ink border border-primary-soft-border',
    icon: (
      <svg
        className="w-3.5 h-3.5 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        />
      </svg>
    ),
  },
  system: {
    label: 'System Access',
    className: 'bg-blue-50 text-blue-700 border border-blue-200',
    icon: (
      <svg
        className="w-3.5 h-3.5 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
  it_admin: {
    label: 'IT / Admin',
    className: 'bg-amber-50 text-amber-800 border border-amber-200',
    icon: (
      <svg
        className="w-3.5 h-3.5 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <circle cx="12" cy="12" r="3" strokeWidth="2" />
      </svg>
    ),
  },
  employee: {
    label: 'Employee Step',
    className: 'bg-purple-50 text-purple-800 border border-purple-200',
    icon: (
      <svg
        className="w-3.5 h-3.5 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  completed: {
    label: 'Completed',
    className: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    icon: (
      <svg
        className="w-3.5 h-3.5 stroke-current"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
};

export function OnboardingStepBadge({ step, className = '' }: OnboardingStepBadgeProps) {
  const config = STEP_CONFIGS[step] || STEP_CONFIGS.hr;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.className} ${className}`}
      role="status"
    >
      {config.icon}
      <span>{config.label}</span>
    </span>
  );
}
