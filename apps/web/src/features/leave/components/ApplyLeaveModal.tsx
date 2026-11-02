import React, { useState, useEffect, useMemo } from 'react';
import type { LeavePolicy, LeaveBalance, Holiday, ApplyForLeavePayload } from '../types';
import { Modal, Button, FormField, Select } from '../../../components/ui';

export interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: LeavePolicy[];
  balances: LeaveBalance[];
  holidays: Holiday[];
  onSubmit: (payload: ApplyForLeavePayload) => Promise<void>;
}

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  policies,
  balances,
  holidays,
  onSubmit,
}) => {
  const activePolicies = useMemo(() => policies.filter((p) => p.isActive), [policies]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default selected policy and reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setLeaveTypeId((prev) => (prev ? prev : (activePolicies[0]?.id ?? '')));
      setStartDate(todayStr);
      setEndDate(todayStr);
      setHalfDay(false);
      setReason('');
      setError(null);
    }
  }, [isOpen]);

  const selectedPolicy = useMemo(
    () => policies.find((p) => p.id === leaveTypeId),
    [policies, leaveTypeId],
  );

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId),
    [balances, leaveTypeId],
  );

  // Calculate estimated working days excluding weekend days and holidays
  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    if (halfDay) return 0.5;

    let count = 0;
    const cur = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    const holidaySet = new Set(holidays.map((h) => h.date));

    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay();
      const dateStr = cur.toISOString().slice(0, 10);

      // Standard work week Mon-Fri (day 1-5); exclude Sat(6) and Sun(0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
        count += 1;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return count;
  }, [startDate, endDate, halfDay, holidays]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (halfDay || val > endDate) {
      setEndDate(val);
    }
    if (error) setError(null);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (error) setError(null);
  };

  const handleHalfDayToggle = (checked: boolean) => {
    setHalfDay(checked);
    if (checked) {
      setEndDate(startDate);
    }
    if (error) setError(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!leaveTypeId) {
      setError('Please select a leave type.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }

    if (halfDay && startDate !== endDate) {
      setError('Half day leave must be for a single date.');
      return;
    }

    // Check policy halfDay rule
    if (halfDay && selectedPolicy && !selectedPolicy.allowHalfDay) {
      setError(`${selectedPolicy.name} does not allow half-day applications.`);
      return;
    }

    // Check backdate limits
    if (selectedPolicy && startDate < todayStr) {
      const diffMs = Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
      const diffDays = Math.floor(diffMs / 86_400_000);
      if (diffDays > selectedPolicy.maxBackdateDays) {
        setError(
          `This leave type allows backdating by at most ${selectedPolicy.maxBackdateDays} day(s). Selected start date is ${diffDays} day(s) in the past.`,
        );
        return;
      }
    }

    // Check balance sufficiency
    if (selectedPolicy?.hasBalance && selectedBalance) {
      if (estimatedDays > selectedBalance.remaining) {
        setError(
          `Insufficient leave balance. You are requesting ${estimatedDays} days, but only have ${selectedBalance.remaining} days remaining for ${selectedPolicy.name}.`,
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        leaveTypeId,
        startDate,
        endDate,
        halfDay,
        reason: reason.trim() ? reason.trim() : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const policyOptions = activePolicies.map((p) => {
    const bal = balances.find((b) => b.leaveTypeId === p.id);
    const balanceText = p.hasBalance && bal ? ` (${bal.remaining}d available)` : '';
    return {
      value: p.id,
      label: `${p.name} [${p.code}]${balanceText}`,
    };
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={isSubmitting || estimatedDays === 0}
            data-testid="submit-leave-request-btn"
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="apply-leave-form">
        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="apply-leave-error-banner"
          >
            {error}
          </div>
        )}

        {/* Leave Type Selector */}
        <FormField
          label="Leave Type"
          htmlFor="apply-leave-type"
          required
          helperText={
            selectedBalance
              ? `${selectedBalance.remaining} days available out of ${selectedBalance.allotted + selectedBalance.carriedForward} total days.`
              : 'Select policy to request leave.'
          }
        >
          <Select
            id="apply-leave-type"
            value={leaveTypeId}
            onChange={(e) => {
              setLeaveTypeId(e.target.value);
              if (error) setError(null);
            }}
            options={policyOptions}
            disabled={isSubmitting}
            aria-label="Select Leave Type"
            className="h-11 min-h-[44px]"
          />
        </FormField>

        {/* Half Day Toggle */}
        {selectedPolicy?.allowHalfDay && (
          <div className="flex items-center gap-3 p-3 rounded-tile bg-surface-muted border border-border">
            <input
              id="apply-half-day-toggle"
              data-testid="apply-half-day-toggle"
              type="checkbox"
              checked={halfDay}
              disabled={isSubmitting}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              className="h-5 w-5 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
            />
            <label
              htmlFor="apply-half-day-toggle"
              className="text-xs font-semibold text-text cursor-pointer select-none"
            >
              Half-Day Leave (0.5 day)
              <span className="block font-normal text-text-muted mt-0.5">
                Applies to a single working day.
              </span>
            </label>
          </div>
        )}

        {/* Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label={halfDay ? 'Date' : 'Start Date'}
            htmlFor="apply-start-date"
            required
            helperText="Format: YYYY-MM-DD"
          >
            <input
              id="apply-start-date"
              data-testid="apply-start-date-input"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
              required
            />
          </FormField>

          {!halfDay && (
            <FormField
              label="End Date"
              htmlFor="apply-end-date"
              required
              helperText="Format: YYYY-MM-DD"
            >
              <input
                id="apply-end-date"
                data-testid="apply-end-date-input"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                required
              />
            </FormField>
          )}
        </div>

        {/* Dynamic Duration Calculation Preview */}
        <div className="p-3 rounded-tile bg-surface-muted border border-border flex items-center justify-between text-xs">
          <div>
            <span className="text-text-subtle block">Calculated Duration</span>
            <span className="text-xs text-text-muted">Excludes weekends and company holidays</span>
          </div>
          <div className="text-right">
            <span
              className="text-sm font-bold text-primary-deep font-mono"
              data-testid="estimated-days-badge"
            >
              {estimatedDays} {estimatedDays === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>

        {/* Reason */}
        <FormField
          label="Reason / Notes (Optional)"
          htmlFor="apply-reason"
          helperText={`${reason.length}/500 characters`}
        >
          <textarea
            id="apply-reason"
            data-testid="apply-reason-input"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            placeholder="Provide context for your team lead and approvers..."
            className="w-full rounded-control border border-border bg-surface p-3 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong"
          />
        </FormField>
      </form>
    </Modal>
  );
};
