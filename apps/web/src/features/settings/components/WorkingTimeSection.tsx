import { useMemo } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { DAY_NAMES, type DayName, calculateWorkDays } from '../types';
import type { SettingsDraft } from '../hooks/useSettings';

function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
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
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

interface WorkingTimeSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  hasError: boolean;
  errorMessage: string | null;
  disabled?: boolean;
}

const DAY_OPTIONS = DAY_NAMES.map((d) => ({
  value: d,
  label: d,
}));

export function WorkingTimeSection({
  draft,
  onUpdate,
  hasError,
  errorMessage,
  disabled = false,
}: WorkingTimeSectionProps) {
  const activeDays = useMemo(() => {
    return calculateWorkDays(draft.workWeekStart, draft.workWeekEnd);
  }, [draft.workWeekStart, draft.workWeekEnd]);

  const shiftStart = draft.shiftStartTime || '09:00';
  const shiftEnd = draft.shiftEndTime || '18:00';
  const standardDailyHours = draft.standardDailyHours || 8;
  const breakMinutes = draft.breakMinutes || 60;

  const totalWeeklyHours = useMemo(() => {
    return (activeDays.length * standardDailyHours).toFixed(1);
  }, [activeDays.length, standardDailyHours]);

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="work-week-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
              <IconClock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text font-display">
              Work Week &amp; Shift Timing
            </h3>
          </div>
          <p className="text-xs text-text-muted mt-1">
            Define official operational days, standard shift start/end hours, and weekly work limits
            for attendance calculations.
          </p>
        </div>

        {!hasError && activeDays.length > 0 && (
          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-primary-soft text-primary-deep">
              {activeDays.length} Days / Week
            </span>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-surface-muted text-text-muted">
              {totalWeeklyHours} hrs / week
            </span>
          </div>
        )}
      </div>

      {/* Week Days Start & End */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <FormField label="Week Start Day" htmlFor="settings-workweek-start" required>
          <Select
            id="settings-workweek-start"
            name="workWeekStart"
            value={draft.workWeekStart}
            onChange={(e) => onUpdate({ workWeekStart: e.target.value as DayName })}
            options={DAY_OPTIONS}
            disabled={disabled}
            data-testid="workweek-start-select"
          />
        </FormField>

        <FormField
          label="Week End Day"
          htmlFor="settings-workweek-end"
          required
          error={errorMessage || undefined}
        >
          <Select
            id="settings-workweek-end"
            name="workWeekEnd"
            value={draft.workWeekEnd}
            onChange={(e) => onUpdate({ workWeekEnd: e.target.value as DayName })}
            options={DAY_OPTIONS}
            disabled={disabled}
            data-testid="workweek-end-select"
          />
        </FormField>
      </div>

      {/* Days Preview Chips */}
      {!hasError && (
        <div className="space-y-2">
          <span className="text-xs font-medium text-text-muted block">Active Work Schedule:</span>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day) => {
              const isWorking = activeDays.includes(day);
              return (
                <span
                  key={day}
                  className={`px-3 py-1 text-xs rounded-xl font-medium transition-colors ${
                    isWorking
                      ? 'bg-primary-soft text-primary-deep border border-primary/20 font-semibold'
                      : 'bg-surface-muted text-text-subtle line-through opacity-70'
                  }`}
                  data-testid={`day-pill-${day}`}
                >
                  {day} {isWorking ? '• Working' : '• Off'}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Standard Shift Timings */}
      <div className="pt-3 border-t border-border/80">
        <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle mb-3">
          Standard Shift Hours
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FormField label="Shift Start Time" htmlFor="shift-start-time" required>
            <Input
              id="shift-start-time"
              type="time"
              value={shiftStart}
              onChange={(e) => onUpdate({ shiftStartTime: e.target.value })}
              disabled={disabled}
              data-testid="shift-start-time-input"
            />
          </FormField>

          <FormField label="Shift End Time" htmlFor="shift-end-time" required>
            <Input
              id="shift-end-time"
              type="time"
              value={shiftEnd}
              onChange={(e) => onUpdate({ shiftEndTime: e.target.value })}
              disabled={disabled}
              data-testid="shift-end-time-input"
            />
          </FormField>

          <FormField label="Daily Required Hours" htmlFor="daily-hours" required>
            <Input
              id="daily-hours"
              type="number"
              step="0.5"
              min="4"
              max="16"
              value={standardDailyHours}
              onChange={(e) => onUpdate({ standardDailyHours: Number(e.target.value) || 8 })}
              disabled={disabled}
              data-testid="daily-hours-input"
            />
          </FormField>

          <FormField label="Break / Lunch Duration" htmlFor="break-duration" required>
            <Select
              id="break-duration"
              value={String(breakMinutes)}
              onChange={(e) => onUpdate({ breakMinutes: Number(e.target.value) || 60 })}
              options={[
                { value: '30', label: '30 minutes' },
                { value: '45', label: '45 minutes' },
                { value: '60', label: '60 minutes (1 hr)' },
                { value: '90', label: '90 minutes (1.5 hrs)' },
              ]}
              disabled={disabled}
              data-testid="break-duration-select"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}
