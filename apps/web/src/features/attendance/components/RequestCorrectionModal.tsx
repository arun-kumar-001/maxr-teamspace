import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { requestCorrection } from '../api/attendance';
import type { AttendanceCorrection, AttendanceRecord } from '../types';

export interface RequestCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: AttendanceRecord | null;
  onSuccess?: (correction: AttendanceCorrection) => void;
}

export const RequestCorrectionModal: React.FC<RequestCorrectionModalProps> = ({
  isOpen,
  onClose,
  record,
  onSuccess,
}) => {
  const [checkInTime, setCheckInTime] = useState('09:00');
  const [checkOutTime, setCheckOutTime] = useState('18:00');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize times from record when opened
  useEffect(() => {
    if (record) {
      if (record.checkInTime) {
        const d = new Date(record.checkInTime);
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const mins = String(d.getUTCMinutes()).padStart(2, '0');
        setCheckInTime(`${hours}:${mins}`);
      } else {
        setCheckInTime('09:00');
      }

      if (record.checkOutTime) {
        const d = new Date(record.checkOutTime);
        const hours = String(d.getUTCHours()).padStart(2, '0');
        const mins = String(d.getUTCMinutes()).padStart(2, '0');
        setCheckOutTime(`${hours}:${mins}`);
      } else {
        setCheckOutTime('18:00');
      }

      setReason('');
      setError(null);
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      setError('Please provide a reason explaining this correction request.');
      return;
    }

    if (!checkInTime || !checkOutTime) {
      setError('Both requested check-in and check-out times are required.');
      return;
    }

    // Construct ISO datetimes in UTC for the record's workDate
    const requestedCheckIn = `${record.workDate}T${checkInTime}:00.000Z`;
    let requestedCheckOut = `${record.workDate}T${checkOutTime}:00.000Z`;

    const inDate = new Date(requestedCheckIn);
    let outDate = new Date(requestedCheckOut);

    // If checkOut is earlier than checkIn, treat as overnight session (next day)
    if (outDate <= inDate) {
      const nextDay = new Date(inDate);
      nextDay.setUTCDate(nextDay.getUTCDate() + 1);
      const nextDayStr = nextDay.toISOString().split('T')[0];
      requestedCheckOut = `${nextDayStr}T${checkOutTime}:00.000Z`;
      outDate = new Date(requestedCheckOut);
    }

    const durationMinutes = (outDate.getTime() - inDate.getTime()) / (1000 * 60);

    if (durationMinutes <= 0) {
      setError('Requested check-out time must be after check-in time.');
      return;
    }

    if (durationMinutes > 24 * 60) {
      setError('A single attendance session cannot exceed 24 hours.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const correction = await requestCorrection({
        attendanceRecordId: record.id,
        requestedCheckIn,
        requestedCheckOut,
        reason: reason.trim(),
      });
      onSuccess?.(correction);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit correction request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDisplayTime = (isoTime: string | null) => {
    if (!isoTime) return 'Not recorded';
    return new Date(isoTime).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Request Attendance Correction"
      maxWidth="md"
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
            disabled={isSubmitting}
            data-testid="submit-correction-button"
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </Button>
        </div>
      }
    >
      <form
        onSubmit={handleSubmit}
        className="space-y-4 py-2"
        data-testid="correction-request-form"
      >
        {/* Record Overview Banner */}
        <div className="p-3.5 bg-surface-muted rounded-tile border border-border text-sm space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-text">Work Date:</span>
            <span className="text-text font-medium">{record.workDate}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>Recorded In: {formatDisplayTime(record.checkInTime)}</span>
            <span>Recorded Out: {formatDisplayTime(record.checkOutTime)}</span>
          </div>
        </div>

        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="correction-form-error"
          >
            {error}
          </div>
        )}

        {/* Requested Check-in Time */}
        <FormField label="Requested Check-In (UTC)" htmlFor="requested-checkin-time" required>
          <input
            id="requested-checkin-time"
            data-testid="requested-checkin-input"
            type="time"
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            value={checkInTime}
            onChange={(e) => {
              setCheckInTime(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            required
          />
        </FormField>

        {/* Requested Check-out Time */}
        <FormField label="Requested Check-Out (UTC)" htmlFor="requested-checkout-time" required>
          <input
            id="requested-checkout-time"
            data-testid="requested-checkout-input"
            type="time"
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            value={checkOutTime}
            onChange={(e) => {
              setCheckOutTime(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            required
          />
        </FormField>

        {/* Reason */}
        <FormField label="Reason for Correction" htmlFor="correction-reason" required>
          <textarea
            id="correction-reason"
            data-testid="correction-reason-input"
            rows={3}
            maxLength={500}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-subtle focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong transition-colors min-h-[88px]"
            placeholder="Explain why the recorded attendance times need correction (e.g., forgot to check out, system network outage)..."
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            required
          />
        </FormField>
      </form>
    </Modal>
  );
};
