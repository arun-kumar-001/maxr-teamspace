import React, { useState } from 'react';
import type { CreateHolidayInput } from '../types';
import { Modal, Button, FormField } from '../../../components/ui';

export interface AddHolidayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateHolidayInput) => Promise<void>;
  defaultYear?: number;
}

export const AddHolidayModal: React.FC<AddHolidayModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  defaultYear = new Date().getFullYear(),
}) => {
  const [date, setDate] = useState(`${defaultYear}-01-01`);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError('Holiday name is required.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Please provide date in YYYY-MM-DD format.');
      return;
    }

    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      setError('Invalid calendar date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({ date, name: nameTrimmed });
      setName('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holiday');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Company Holiday"
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
            data-testid="submit-holiday-btn"
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Adding...' : 'Add Holiday'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="add-holiday-form">
        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="holiday-form-error"
          >
            {error}
          </div>
        )}

        <FormField
          label="Holiday Date"
          htmlFor="holiday-date"
          required
          helperText="Format: YYYY-MM-DD"
        >
          <input
            id="holiday-date"
            data-testid="holiday-date-input"
            type="date"
            min="2000-01-01"
            max="2100-12-31"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            required
          />
        </FormField>

        <FormField
          label="Holiday Name"
          htmlFor="holiday-name"
          required
          helperText="e.g. New Year's Day, Independence Day, Diwali"
        >
          <input
            id="holiday-name"
            data-testid="holiday-name-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Independence Day"
            maxLength={100}
            disabled={isSubmitting}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            required
          />
        </FormField>
      </form>
    </Modal>
  );
};
