import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import type { AttendancePolicy, Shift, UpdateAttendancePolicyPayload } from '../types';

export interface AttendancePolicyCardProps {
  policy: AttendancePolicy | null;
  shifts: Shift[];
  onUpdate: (payload: UpdateAttendancePolicyPayload) => Promise<void>;
  isLoading?: boolean;
  canEdit?: boolean;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const AttendancePolicyCard: React.FC<AttendancePolicyCardProps> = ({
  policy,
  shifts,
  onUpdate,
  isLoading = false,
  canEdit = true,
}) => {
  const [fullDayMinutes, setFullDayMinutes] = useState(480);
  const [halfDayMinutes, setHalfDayMinutes] = useState(240);
  const [defaultShiftId, setDefaultShiftId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (policy) {
      setFullDayMinutes(policy.fullDayMinutes);
      setHalfDayMinutes(policy.halfDayMinutes);
      setDefaultShiftId(policy.defaultShiftId);
    }
  }, [policy]);

  if (!policy) return null;

  const activeShifts = shifts.filter((s) => s.isActive);
  const shiftOptions = activeShifts.map((s) => ({
    value: s.id,
    label: `${s.name} (${s.startTime} - ${s.endTime})`,
  }));

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (halfDayMinutes >= fullDayMinutes) {
      setError('Half day duration must be strictly less than full day duration.');
      return;
    }

    if (fullDayMinutes <= 0 || halfDayMinutes <= 0) {
      setError('Duration minutes must be positive numbers.');
      return;
    }

    if (!defaultShiftId) {
      setError('A default fallback shift must be selected.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      setSuccess(null);
      await onUpdate({
        fullDayMinutes,
        halfDayMinutes,
        defaultShiftId,
      });
      setSuccess('Attendance policy updated successfully.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update attendance policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const workWeekText = policy.workWeek.map((dayNum) => DAY_NAMES[dayNum % 7]).join(', ');

  return (
    <div
      className="p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="attendance-policy-card"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-4">
        <div>
          <h2 className="text-lg font-bold text-text font-display">Company Attendance Policy</h2>
          <p className="text-xs text-text-muted mt-0.5">
            Defines work day thresholds, fallback shift assignment, and operating timezone.
          </p>
        </div>
        <span className="text-xs font-mono px-2.5 py-1 rounded bg-surface-muted border border-border text-text self-start sm:self-auto">
          {policy.timezone}
        </span>
      </div>

      {error && (
        <div
          className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
          role="alert"
          data-testid="policy-error-banner"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          className="p-3 rounded-control bg-emerald-50 border border-emerald-200 text-xs text-emerald-800"
          role="status"
          data-testid="policy-success-banner"
        >
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Full Day Minutes */}
          <FormField
            label="Full Day Threshold"
            htmlFor="full-day-minutes"
            helperText={`${Math.floor(fullDayMinutes / 60)}h ${fullDayMinutes % 60}m required`}
          >
            <div className="relative">
              <input
                id="full-day-minutes"
                data-testid="full-day-input"
                type="number"
                min={60}
                max={1440}
                step={15}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                value={fullDayMinutes}
                onChange={(e) => {
                  setFullDayMinutes(Number(e.target.value));
                  if (error) setError(null);
                }}
                disabled={!canEdit || isSubmitting || isLoading}
                required
              />
              <span className="absolute right-3 top-3 text-xs text-text-subtle pointer-events-none">
                minutes
              </span>
            </div>
          </FormField>

          {/* Half Day Minutes */}
          <FormField
            label="Half Day Threshold"
            htmlFor="half-day-minutes"
            helperText={`${Math.floor(halfDayMinutes / 60)}h ${halfDayMinutes % 60}m required`}
          >
            <div className="relative">
              <input
                id="half-day-minutes"
                data-testid="half-day-input"
                type="number"
                min={30}
                max={720}
                step={15}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                value={halfDayMinutes}
                onChange={(e) => {
                  setHalfDayMinutes(Number(e.target.value));
                  if (error) setError(null);
                }}
                disabled={!canEdit || isSubmitting || isLoading}
                required
              />
              <span className="absolute right-3 top-3 text-xs text-text-subtle pointer-events-none">
                minutes
              </span>
            </div>
          </FormField>

          {/* Default Shift */}
          <FormField
            label="Default Fallback Shift"
            htmlFor="default-shift-select"
            helperText="Applied when an employee has no specific assignment."
          >
            <Select
              id="default-shift-select"
              aria-label="Default Shift"
              value={defaultShiftId}
              onChange={(e) => {
                setDefaultShiftId(e.target.value);
                if (error) setError(null);
              }}
              options={shiftOptions}
              disabled={!canEdit || isSubmitting || isLoading}
              className="h-11 min-h-[44px]"
            />
          </FormField>
        </div>

        {/* Operating Environment Information */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-tile bg-surface-muted border border-border text-sm">
          <div>
            <span className="text-xs text-text-subtle block">Standard Work Week</span>
            <span className="font-medium text-text mt-0.5 block">
              {workWeekText || 'Configured in company settings'}
            </span>
          </div>
          <div>
            <span className="text-xs text-text-subtle block">Company Operating Timezone</span>
            <span className="font-medium text-text mt-0.5 block">
              {policy.timezone} (UTC boundaries evaluated locally)
            </span>
          </div>
        </div>

        {canEdit && (
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting || isLoading}
              data-testid="save-policy-btn"
              className="min-h-[44px]"
            >
              {isSubmitting ? 'Saving Policy...' : 'Save Policy Changes'}
            </Button>
          </div>
        )}
      </form>
    </div>
  );
};
