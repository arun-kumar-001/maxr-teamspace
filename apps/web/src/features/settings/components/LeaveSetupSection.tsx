import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import type { SettingsDraft } from '../hooks/useSettings';

function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
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
    </svg>
  );
}

interface LeaveSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

export function LeaveSetupSection({
  draft,
  onUpdate,
  disabled = false,
}: LeaveSetupSectionProps) {
  const annualLeaveDays = draft.annualLeaveDays ?? 18;
  const casualLeaveDays = draft.casualLeaveDays ?? 12;
  const sickLeaveDays = draft.sickLeaveDays ?? 12;
  const approvalFlow = draft.leaveApprovalFlow ?? 'lead_only';
  const advanceNoticeDays = draft.advanceNoticeDays ?? 2;
  const excludeWeekends = draft.excludeWeekendsFromLeave ?? true;

  const totalQuota = annualLeaveDays + casualLeaveDays + sickLeaveDays;

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="leave-setup-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
              <IconCalendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text font-display">
              Leave Policy &amp; Approval Routing
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Set annual leave quotas, default approval workflow tiers, and calendar calculation rules.
          </p>
        </div>

        <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 self-start sm:self-auto">
          {totalQuota} Total Days / Year
        </div>
      </div>

      {/* Quotas Grid */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle mb-3">
          Annual Leave Allowances (Days Per Year)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <FormField
            label="Annual / Paid Leave"
            htmlFor="leave-annual-quota"
            helperText="Standard annual paid leave"
            required
          >
            <Input
              id="leave-annual-quota"
              type="number"
              min="0"
              max="60"
              value={annualLeaveDays}
              onChange={(e) => onUpdate({ annualLeaveDays: Number(e.target.value) || 0 })}
              disabled={disabled}
              data-testid="annual-leave-quota-input"
            />
          </FormField>

          <FormField
            label="Casual Leave"
            htmlFor="leave-casual-quota"
            helperText="Short-notice personal leaves"
            required
          >
            <Input
              id="leave-casual-quota"
              type="number"
              min="0"
              max="30"
              value={casualLeaveDays}
              onChange={(e) => onUpdate({ casualLeaveDays: Number(e.target.value) || 0 })}
              disabled={disabled}
              data-testid="casual-leave-quota-input"
            />
          </FormField>

          <FormField
            label="Sick / Medical Leave"
            htmlFor="leave-sick-quota"
            helperText="Health and medical appointments"
            required
          >
            <Input
              id="leave-sick-quota"
              type="number"
              min="0"
              max="30"
              value={sickLeaveDays}
              onChange={(e) => onUpdate({ sickLeaveDays: Number(e.target.value) || 0 })}
              disabled={disabled}
              data-testid="sick-leave-quota-input"
            />
          </FormField>
        </div>
      </div>

      {/* Workflow & Rules */}
      <div className="pt-3 border-t border-border/80">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle mb-3">
          Approval Routing &amp; Calculation
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <FormField
            label="Default Approval Workflow"
            htmlFor="leave-approval-flow"
            helperText="Designates who receives and approves employee requests"
            required
          >
            <Select
              id="leave-approval-flow"
              value={approvalFlow}
              onChange={(e) =>
                onUpdate({
                  leaveApprovalFlow: e.target.value as 'lead_only' | 'hr_only' | 'two_tier',
                })
              }
              options={[
                { value: 'lead_only', label: 'Direct Team Lead Only' },
                { value: 'hr_only', label: 'HR Manager Only' },
                { value: 'two_tier', label: 'Two-Tier (Team Lead ➔ HR Manager)' },
              ]}
              disabled={disabled}
              data-testid="leave-approval-flow-select"
            />
          </FormField>

          <FormField
            label="Advance Notice Required"
            htmlFor="leave-advance-notice"
            helperText="Minimum notice days before planned leave starts"
            required
          >
            <Select
              id="leave-advance-notice"
              value={String(advanceNoticeDays)}
              onChange={(e) => onUpdate({ advanceNoticeDays: Number(e.target.value) || 0 })}
              options={[
                { value: '0', label: '0 days (Same-day allowed)' },
                { value: '1', label: '1 day in advance' },
                { value: '2', label: '2 days in advance (Recommended)' },
                { value: '3', label: '3 days in advance' },
                { value: '7', label: '7 days in advance' },
              ]}
              disabled={disabled}
              data-testid="leave-advance-notice-select"
            />
          </FormField>
        </div>

        {/* Exclude Weekends & Holidays Toggle */}
        <div className="mt-4 p-4 rounded-2xl bg-surface-muted/60 border border-border/80 flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-text block">
              Exclude Weekends &amp; Public Holidays from Leave Count
            </span>
            <span className="text-[11px] text-text-muted block">
              When checked, Saturdays, Sundays, and official gazetted company holidays do not deduct
              from the employee leave balance.
            </span>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={excludeWeekends}
              onChange={(e) => onUpdate({ excludeWeekendsFromLeave: e.target.checked })}
              disabled={disabled}
              className="sr-only peer"
              aria-label="Exclude weekends from leave count"
            />
            <div className="w-11 h-6 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-deep" />
          </label>
        </div>
      </div>
    </div>
  );
}
