import { EmptyState, Skeleton } from '../../../components/ui';
import type { OnboardingChecklistSummary, OnboardingStep } from '../types/onboarding';
import { OnboardingStepBadge } from './OnboardingStepBadge';

export interface OnboardingBoardProps {
  checklists: OnboardingChecklistSummary[];
  isLoading: boolean;
  onSelectEmployee: (employeeId: string) => void;
}

const STEP_COLUMNS: { step: OnboardingStep; title: string; description: string }[] = [
  { step: 'hr', title: 'HR Setup', description: 'Offer, identity & documents' },
  { step: 'system', title: 'System Access', description: 'Email, permissions & accounts' },
  { step: 'it_admin', title: 'IT / Admin', description: 'Hardware, badge & workspace' },
  { step: 'employee', title: 'Employee Setup', description: 'Password, profile & policies' },
];

export function OnboardingBoard({ checklists, isLoading, onSelectEmployee }: OnboardingBoardProps) {
  if (isLoading) {
    return (
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        data-testid="onboarding-board-loading"
      >
        {[1, 2, 3, 4].map((col) => (
          <div key={col} className="p-4 bg-surface rounded-card border border-border space-y-4">
            <Skeleton height={24} width="60%" />
            <Skeleton height={14} width="80%" />
            <div className="space-y-3 pt-2">
              <Skeleton height={96} variant="rectangular" />
              <Skeleton height={96} variant="rectangular" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (checklists.length === 0) {
    return (
      <EmptyState
        title="No Onboarding In Progress"
        description="There are currently no active employee onboarding workflows matching the filters."
      />
    );
  }

  const renderCard = (chk: OnboardingChecklistSummary) => {
    const progressPercent =
      chk.totalItems > 0 ? Math.round((chk.verifiedItems / chk.totalItems) * 100) : 0;

    return (
      <div
        key={chk.id}
        tabIndex={0}
        role="button"
        onClick={() => onSelectEmployee(chk.employeeId)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectEmployee(chk.employeeId);
          }
        }}
        className="p-4 bg-surface rounded-tile border border-border hover:border-primary-strong/50 hover:shadow-raised transition-all cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-primary-strong space-y-3"
        data-testid={`onboarding-card-${chk.employeeId}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-text text-sm sm:text-base leading-snug">
              {chk.firstName} {chk.lastName}
            </div>
            <div className="text-xs font-mono text-text-muted">{chk.employeeCode}</div>
          </div>
          <OnboardingStepBadge step={chk.currentStep} />
        </div>

        <div className="text-xs text-text-muted flex items-center justify-between">
          <span className="truncate max-w-[140px]">{chk.departmentName}</span>
          <span className="font-medium text-text">
            {chk.verifiedItems}/{chk.totalItems} verified
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-surface-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-primary-strong h-full rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6" data-testid="onboarding-board">
      {/* Mobile Single Column / List View */}
      <div className="block sm:hidden space-y-3">{checklists.map(renderCard)}</div>

      {/* Tablet (2x2 Grid) & Desktop (4 Columns) */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
        {STEP_COLUMNS.map((col) => {
          const colChecklists = checklists.filter((chk) => chk.currentStep === col.step);

          return (
            <div
              key={col.step}
              className="bg-surface-raised/40 p-3 sm:p-4 rounded-card border border-border space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border pb-2.5">
                <div>
                  <h3 className="text-sm font-bold text-text">{col.title}</h3>
                  <p className="text-xs text-text-subtle hidden lg:block">{col.description}</p>
                </div>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-muted text-text-muted">
                  {colChecklists.length}
                </span>
              </div>

              <div className="space-y-3 min-h-[120px]">
                {colChecklists.length === 0 ? (
                  <div className="text-center py-8 text-xs text-text-subtle italic border border-dashed border-border rounded-tile">
                    No employees in this stage
                  </div>
                ) : (
                  colChecklists.map(renderCard)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
