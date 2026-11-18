import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import type { SettingsDraft } from '../hooks/useSettings';

function IconCalendarCheck({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

interface AttendanceSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

export function AttendanceSetupSection({
  draft,
  onUpdate,
  disabled = false,
}: AttendanceSetupSectionProps) {
  const graceMinutes = draft.graceMinutes ?? 15;
  const halfDayCutoffMinutes = draft.halfDayCutoffMinutes ?? 120;
  const autoCheckoutHours = draft.autoCheckoutHours ?? 14;

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="attendance-setup-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <IconCalendarCheck className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text font-display">
              Attendance Rules &amp; Policies
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Configure check-in grace minutes, late cutoffs, auto-checkout limits, and single open-session enforcement.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <FormField
          label="Check-in Grace Period"
          htmlFor="attendance-grace-minutes"
          helperText="Minutes allowed past shift start before marked Late"
          required
        >
          <Select
            id="attendance-grace-minutes"
            value={String(graceMinutes)}
            onChange={(e) => onUpdate({ graceMinutes: Number(e.target.value) || 15 })}
            options={[
              { value: '0', label: '0 minutes (Strict)' },
              { value: '5', label: '5 minutes' },
              { value: '10', label: '10 minutes' },
              { value: '15', label: '15 minutes (Standard)' },
              { value: '30', label: '30 minutes' },
            ]}
            disabled={disabled}
            data-testid="grace-minutes-select"
          />
        </FormField>

        <FormField
          label="Half-Day Late Threshold"
          htmlFor="attendance-half-day-cutoff"
          helperText="Arrival after this duration triggers half-day deduction"
          required
        >
          <Select
            id="attendance-half-day-cutoff"
            value={String(halfDayCutoffMinutes)}
            onChange={(e) => onUpdate({ halfDayCutoffMinutes: Number(e.target.value) || 120 })}
            options={[
              { value: '60', label: '60 minutes (1 hr)' },
              { value: '90', label: '90 minutes (1.5 hrs)' },
              { value: '120', label: '120 minutes (2 hrs)' },
              { value: '180', label: '180 minutes (3 hrs)' },
            ]}
            disabled={disabled}
            data-testid="half-day-cutoff-select"
          />
        </FormField>

        <FormField
          label="Auto Check-Out Limit"
          htmlFor="attendance-auto-checkout"
          helperText="Auto-closes unclosed punches to prevent orphan sessions"
          required
        >
          <Select
            id="attendance-auto-checkout"
            value={String(autoCheckoutHours)}
            onChange={(e) => onUpdate({ autoCheckoutHours: Number(e.target.value) || 14 })}
            options={[
              { value: '10', label: '10 hours' },
              { value: '12', label: '12 hours' },
              { value: '14', label: '14 hours (Default)' },
              { value: '16', label: '16 hours' },
            ]}
            disabled={disabled}
            data-testid="auto-checkout-select"
          />
        </FormField>
      </div>

      {/* Rules Notice Callout */}
      <div className="p-4 rounded-2xl bg-surface-muted border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="space-y-1">
          <div className="font-bold text-text flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Strict Single Open-Session Guarantee</span>
          </div>
          <p className="text-text-muted">
            The database enforces at most one open attendance session per employee at any time. Duplicate punches are automatically rejected.
          </p>
        </div>
        <span className="inline-flex items-center px-2.5 py-1 rounded-full font-semibold bg-emerald-100 text-emerald-800 shrink-0">
          Enforced
        </span>
      </div>
    </div>
  );
}
