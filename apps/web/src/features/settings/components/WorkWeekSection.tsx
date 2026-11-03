import { useMemo } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { DAY_NAMES, type DayName, calculateWorkDays } from '../types';
import type { SettingsDraft } from '../hooks/useSettings';

interface WorkWeekSectionProps {
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

export function WorkWeekSection({
  draft,
  onUpdate,
  hasError,
  errorMessage,
  disabled = false,
}: WorkWeekSectionProps) {
  const activeDays = useMemo(() => {
    return calculateWorkDays(draft.workWeekStart, draft.workWeekEnd);
  }, [draft.workWeekStart, draft.workWeekEnd]);

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-5"
      data-testid="work-week-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-text">Work Week Schedule</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Defines official operational days for shifts, attendance calculations, and leave
            deductions.
          </p>
        </div>
        {!hasError && activeDays.length > 0 && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-primary-soft text-primary-strong self-start sm:self-auto">
            {activeDays.length} Working Days / Week
          </span>
        )}
      </div>

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

      {/* Days Preview */}
      {!hasError && (
        <div className="pt-2 border-t border-border">
          <span className="text-xs font-medium text-text-subtle block mb-2">
            Weekly Working Days:
          </span>
          <div className="flex flex-wrap gap-2">
            {DAY_NAMES.map((day) => {
              const isWorking = activeDays.includes(day);
              return (
                <span
                  key={day}
                  className={`px-2.5 py-1 text-xs rounded-input font-medium transition-colors ${
                    isWorking
                      ? 'bg-primary-soft text-primary-ink border border-primary/20'
                      : 'bg-surface-muted text-text-subtle line-through'
                  }`}
                  data-testid={`day-pill-${day}`}
                >
                  {day}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
