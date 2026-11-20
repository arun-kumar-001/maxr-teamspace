import { useMemo } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { TimePicker } from '../../../components/ui/TimePicker';
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

const DAY_COLOR_CONFIG: Record<DayName, { bg: string; border: string; text: string }> = {
  Monday: {
    bg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-900',
  },
  Tuesday: {
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
  },
  Wednesday: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-900',
  },
  Thursday: {
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    text: 'text-rose-900',
  },
  Friday: {
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
  },
  Saturday: {
    bg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-900',
  },
  Sunday: {
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-900',
  },
};

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

  const workingDays = useMemo(() => activeDays, [activeDays]);
  const offDays = useMemo(() => {
    return DAY_NAMES.filter((day) => !activeDays.includes(day));
  }, [activeDays]);

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
            <div className="w-7 h-7 rounded-lg bg-primary-soft text-primary-deep flex items-center justify-center shrink-0">
              <IconClock className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-text font-display">
              Work Week &amp; Shift Timing
            </h3>
          </div>
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

      {/* 2-Column Responsive Layout: Left (Inputs) vs Right (Active Work Schedule) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Week Start/End Days + Standard Shift Hours */}
        <div className="lg:col-span-6 space-y-6">
          {/* Week Days Start & End */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

          {/* Standard Shift Timings with Clock Design TimePicker */}
          <div className="pt-4 border-t border-border/80 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle">
              Standard Shift Hours
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Shift Start Time" htmlFor="shift-start-time" required>
                <TimePicker
                  id="shift-start-time"
                  value={shiftStart}
                  onChange={(val) => onUpdate({ shiftStartTime: val })}
                  disabled={disabled}
                  data-testid="shift-start-time-input"
                />
              </FormField>

              <FormField label="Shift End Time" htmlFor="shift-end-time" required>
                <TimePicker
                  id="shift-end-time"
                  value={shiftEnd}
                  onChange={(val) => onUpdate({ shiftEndTime: val })}
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

        {/* Right Column: Active Work Schedule Card (Split: Working vs Work Off) */}
        <div className="lg:col-span-6 bg-surface-muted/60 border border-border/80 rounded-2xl p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-text-subtle">
                Active Work Schedule
              </h4>
              <p className="text-xs text-text-muted mt-0.5">Weekly operational breakdown</p>
            </div>
          </div>

          {/* Horizontal Grid Sections: Working Days & Work Off Days */}
          {!hasError ? (
            <div className="space-y-4 pt-1">
              {/* Working Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-primary/20">
                  <span className="text-xs font-bold text-text uppercase tracking-wider">
                    Working
                  </span>
                  <span className="text-[11px] font-semibold text-primary-deep bg-primary-soft px-2 py-0.5 rounded-full">
                    {workingDays.length} {workingDays.length === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {workingDays.map((day) => {
                    const color = DAY_COLOR_CONFIG[day];
                    return (
                      <div
                        key={day}
                        className={`flex items-center justify-center px-3 py-2.5 rounded-xl border transition-all ${color.bg} ${color.border} shadow-2xs`}
                        data-testid={`day-pill-${day}`}
                      >
                        <span
                          className={`font-display font-bold text-sm tracking-wide ${color.text}`}
                        >
                          {day}
                        </span>
                      </div>
                    );
                  })}
                  {workingDays.length === 0 && (
                    <p className="text-xs text-text-subtle italic px-2 py-2 col-span-full">
                      No working days
                    </p>
                  )}
                </div>
              </div>

              {/* Work Off Section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1 pb-1 border-b border-border/80">
                  <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">
                    Work Off
                  </span>
                  <span className="text-[11px] font-semibold text-text-muted bg-surface-muted px-2 py-0.5 rounded-full">
                    {offDays.length} {offDays.length === 1 ? 'Day' : 'Days'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {offDays.map((day) => {
                    const color = DAY_COLOR_CONFIG[day];
                    return (
                      <div
                        key={day}
                        className={`flex items-center justify-center px-3 py-2.5 rounded-xl border transition-all ${color.bg} ${color.border} shadow-2xs opacity-90`}
                        data-testid={`day-pill-${day}`}
                      >
                        <span
                          className={`font-display font-bold text-sm tracking-wide ${color.text}`}
                        >
                          {day}
                        </span>
                      </div>
                    );
                  })}
                  {offDays.length === 0 && (
                    <p className="text-xs text-text-subtle italic px-2 py-2 col-span-full">
                      No off days
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 text-xs text-text-muted bg-surface/80 border border-border rounded-xl">
              Select valid operational days to preview the weekly schedule.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
