import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import type { CreateShiftPayload, Shift, UpdateShiftPayload } from '../types';

export interface ShiftFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  shift: Shift | null;
  onSubmit: (payload: CreateShiftPayload | UpdateShiftPayload) => Promise<void>;
}

export const ShiftFormModal: React.FC<ShiftFormModalProps> = ({
  isOpen,
  onClose,
  shift,
  onSubmit,
}) => {
  const isEditing = Boolean(shift);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [graceMinutes, setGraceMinutes] = useState(15);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shift) {
      setCode(shift.code);
      setName(shift.name);
      setStartTime(shift.startTime);
      setEndTime(shift.endTime);
      setGraceMinutes(shift.graceMinutes);
      setIsActive(shift.isActive);
    } else {
      setCode('');
      setName('');
      setStartTime('09:00');
      setEndTime('18:00');
      setGraceMinutes(15);
      setIsActive(true);
    }
    setError(null);
  }, [shift, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Shift name is required.');
      return;
    }

    if (!isEditing && !code.trim()) {
      setError('Shift code is required.');
      return;
    }

    if (!isEditing && !/^[A-Za-z0-9_-]{2,20}$/.test(code.trim())) {
      setError('Shift code must be 2-20 alphanumeric characters, hyphens, or underscores.');
      return;
    }

    if (startTime === endTime) {
      setError('Shift start time and end time cannot be identical.');
      return;
    }

    if (graceMinutes < 0 || graceMinutes > 240) {
      setError('Grace period must be between 0 and 240 minutes.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (isEditing) {
        await onSubmit({
          name: name.trim(),
          startTime,
          endTime,
          graceMinutes,
          isActive,
        });
      } else {
        await onSubmit({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          startTime,
          endTime,
          graceMinutes,
        });
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save shift');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title={isEditing ? 'Edit Shift Definition' : 'Create New Shift'}
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
            data-testid="submit-shift-btn"
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Shift'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="shift-form">
        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="shift-form-error"
          >
            {error}
          </div>
        )}

        {/* Shift Code */}
        <FormField
          label="Shift Code"
          htmlFor="shift-code"
          required={!isEditing}
          helperText={
            isEditing
              ? 'Shift code is immutable once created.'
              : 'Unique identifier, e.g. MORNING, NIGHT, ROTATIONAL.'
          }
        >
          <input
            id="shift-code"
            data-testid="shift-code-input"
            type="text"
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong disabled:bg-surface-muted disabled:text-text-subtle h-11 min-h-[44px]"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (error) setError(null);
            }}
            disabled={isEditing || isSubmitting}
            required={!isEditing}
          />
        </FormField>

        {/* Shift Name */}
        <FormField label="Shift Name" htmlFor="shift-name" required>
          <input
            id="shift-name"
            data-testid="shift-name-input"
            type="text"
            placeholder="e.g. Standard General Shift"
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            disabled={isSubmitting}
            required
          />
        </FormField>

        {/* Times Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Start Time (Company Local)" htmlFor="shift-start" required>
            <input
              id="shift-start"
              data-testid="shift-start-input"
              type="time"
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              required
            />
          </FormField>

          <FormField label="End Time (Company Local)" htmlFor="shift-end" required>
            <input
              id="shift-end"
              data-testid="shift-end-input"
              type="time"
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                if (error) setError(null);
              }}
              disabled={isSubmitting}
              required
            />
          </FormField>
        </div>

        {/* Grace Minutes */}
        <FormField
          label="Grace Period (Minutes)"
          htmlFor="shift-grace"
          helperText="Threshold before check-in is flagged as late (0 to 240 mins)."
        >
          <input
            id="shift-grace"
            data-testid="shift-grace-input"
            type="number"
            min={0}
            max={240}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            value={graceMinutes}
            onChange={(e) => {
              setGraceMinutes(Number(e.target.value));
              if (error) setError(null);
            }}
            disabled={isSubmitting}
          />
        </FormField>

        {/* Active Toggle (Editing only) */}
        {isEditing && (
          <div className="flex items-center gap-3 pt-2">
            <input
              id="shift-active"
              data-testid="shift-active-checkbox"
              type="checkbox"
              className="w-4 h-4 text-primary-strong rounded border-border focus:ring-primary-strong"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSubmitting}
            />
            <label htmlFor="shift-active" className="text-sm font-medium text-text select-none">
              Shift is Active
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
};
