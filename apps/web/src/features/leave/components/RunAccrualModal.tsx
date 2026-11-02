import React, { useState } from 'react';
import { Modal, Button, FormField } from '../../../components/ui';

export interface RunAccrualModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunAccrual: (year: number) => Promise<{ year: number; created: number }>;
  defaultYear?: number;
}

export const RunAccrualModal: React.FC<RunAccrualModalProps> = ({
  isOpen,
  onClose,
  onRunAccrual,
  defaultYear = new Date().getFullYear(),
}) => {
  const [year, setYear] = useState(defaultYear);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ year: number; created: number } | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const targetYear = Number(year);
    if (targetYear < 2000 || targetYear > 2100) {
      setError('Please provide a valid year between 2000 and 2100.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await onRunAccrual(targetYear);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute yearly leave accrual');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    setError(null);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Execute Yearly Leave Accrual"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            {result ? 'Done' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
              data-testid="confirm-run-accrual-btn"
              className="min-h-[44px]"
            >
              {isSubmitting ? 'Running Accrual...' : 'Run Accrual'}
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4 py-2" data-testid="run-accrual-modal-content">
        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="accrual-error"
          >
            {error}
          </div>
        )}

        {result ? (
          <div
            className="p-4 rounded-tile bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-2"
            role="status"
            data-testid="accrual-success"
          >
            <h4 className="font-bold text-sm">Yearly Accrual Completed</h4>
            <p className="text-xs">
              Successfully generated <strong>{result.created}</strong> new employee leave balance
              records for calendar year <strong>{result.year}</strong>. Carry forward caps and
              policy quotas were accurately applied.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-xs text-text-muted">
              The yearly accrual job initializes employee balances for all active staff, carrying
              over unused days from the preceding year up to each policy’s configured{' '}
              <code>carryForwardMax</code> threshold.
            </p>

            <FormField
              label="Calendar Year"
              htmlFor="accrual-year"
              required
              helperText="Target year to allocate quotas (e.g. 2026)"
            >
              <input
                id="accrual-year"
                data-testid="accrual-year-input"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                required
              />
            </FormField>
          </form>
        )}
      </div>
    </Modal>
  );
};
