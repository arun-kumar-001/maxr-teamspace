import React, { useEffect, useId, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { submitClaim } from '../api/expensesApi';
import type { ExpenseCategory, ExpenseClaim } from '../types';
import { inrToPaise } from '../types';

interface ExpenseClaimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: ExpenseCategory[];
  onSuccess: (claim: ExpenseClaim) => void;
}

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ExpenseClaimFormModal: React.FC<ExpenseClaimFormModalProps> = ({
  isOpen,
  onClose,
  categories,
  onSuccess,
}) => {
  const fileInputId = useId();
  const descId = useId();

  const todayStr = new Date().toISOString().slice(0, 10);
  const sixtyDaysAgoStr = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [categoryId, setCategoryId] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [amountRupees, setAmountRupees] = useState('');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCategoryId(categories[0]?.id ?? '');
      setExpenseDate(todayStr);
      setAmountRupees('');
      setDescription('');
      setReceiptFile(null);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, categories, todayStr]);

  const numAmount = parseFloat(amountRupees || '0');
  const amountPaise = inrToPaise(numAmount);
  const isReceiptMandatory = amountPaise > 20_000; // > ₹200.00

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      setError('Receipt file size cannot exceed 5 MB');
      return;
    }

    const type = file.type.toLowerCase();
    if (
      !type.startsWith('image/') &&
      type !== 'application/pdf' &&
      !file.name.match(/\.(jpe?g|png|pdf)$/i)
    ) {
      setError('Receipt must be an image (JPEG, PNG) or PDF document');
      return;
    }

    setError(null);
    setReceiptFile(file);
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        // Strip data:...;base64,
        const base64 = res.split(',')[1] ?? '';
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!categoryId) {
      setError('Please select an expense category');
      return;
    }

    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than ₹0');
      return;
    }

    if (numAmount > 100_000) {
      setError('Amount cannot exceed ₹100,000.00');
      return;
    }

    if (expenseDate > todayStr) {
      setError('Expense date cannot be in the future');
      return;
    }

    if (expenseDate < sixtyDaysAgoStr) {
      setError('Expense date cannot be older than 60 days');
      return;
    }

    if (!description.trim()) {
      setError('Please enter an expense description');
      return;
    }

    if (isReceiptMandatory && !receiptFile) {
      setError('Receipt is required for claims over ₹200.00');
      return;
    }

    setIsSubmitting(true);

    try {
      let receiptPayload: { filename: string; declaredType: string; base64: string } | undefined;

      if (receiptFile) {
        const base64 = await readFileAsBase64(receiptFile);
        receiptPayload = {
          filename: receiptFile.name,
          declaredType: receiptFile.type || 'application/octet-stream',
          base64,
        };
      }

      const created = await submitClaim({
        categoryId,
        amountPaise,
        expenseDate,
        description: description.trim(),
        receipt: receiptPayload,
      });

      onSuccess(created);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit expense claim';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Submit Expense Claim"
      maxWidth="lg"
      footer={
        <div className="flex justify-end items-center gap-3 w-full">
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting || (isReceiptMandatory && !receiptFile)}
          >
            Submit Claim
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-1">
        {error && (
          <div
            className="p-3 text-sm text-negative-ink bg-negative-soft border border-negative-soft-border rounded-control"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* Category */}
        <FormField label="Expense Category" htmlFor="expense-category" required>
          <Select
            id="expense-category"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={isSubmitting}
            required
          />
        </FormField>

        {/* Amount & Date in 2 columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Amount (INR ₹)"
            htmlFor="expense-amount"
            helperText={numAmount > 0 ? `Equivalent to ${amountPaise} paise` : undefined}
            required
          >
            <Input
              id="expense-amount"
              type="number"
              step="0.01"
              min="0.01"
              max="100000"
              placeholder="e.g. 450.00"
              value={amountRupees}
              onChange={(e) => setAmountRupees(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </FormField>

          <FormField
            label="Expense Date"
            htmlFor="expense-date"
            helperText="Within last 60 days"
            required
          >
            <Input
              id="expense-date"
              type="date"
              max={todayStr}
              min={sixtyDaysAgoStr}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              disabled={isSubmitting}
              required
            />
          </FormField>
        </div>

        {/* Description */}
        <FormField label="Description & Business Purpose" htmlFor={descId} required>
          <textarea
            id={descId}
            rows={3}
            className="w-full px-3 py-2 text-sm bg-surface-raised border border-border rounded-control text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:opacity-50"
            placeholder="Explain the work purpose for this expense..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitting}
            maxLength={2000}
            required
          />
        </FormField>

        {/* Receipt Upload */}
        <FormField
          label={`Receipt ${isReceiptMandatory ? '(Required)' : '(Optional)'}`}
          htmlFor={fileInputId}
          helperText={
            isReceiptMandatory
              ? 'Required for expenses exceeding ₹200.00. PDF, JPG, or PNG up to 5 MB.'
              : 'Optional for expenses ₹200.00 or less. PDF, JPG, or PNG up to 5 MB.'
          }
          required={isReceiptMandatory}
        >
          <div className="mt-1 flex flex-col gap-2">
            {!receiptFile ? (
              <label
                htmlFor={fileInputId}
                className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-tile cursor-pointer transition-colors ${
                  isReceiptMandatory
                    ? 'border-primary-strong bg-primary-soft/40 hover:bg-primary-soft/70'
                    : 'border-border bg-surface-muted hover:bg-surface-raised'
                }`}
              >
                <svg
                  className="w-8 h-8 mb-2 text-text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <span className="text-sm font-medium text-text">Take photo or select receipt</span>
                <span className="text-xs text-text-subtle mt-1">
                  Camera / file upload (JPEG, PNG, PDF up to 5 MB)
                </span>
                <input
                  id={fileInputId}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  capture="environment"
                  className="sr-only"
                  onChange={handleFileChange}
                  disabled={isSubmitting}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between p-3 bg-surface-raised border border-border rounded-tile">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="truncate">
                    <p className="text-sm font-medium text-text truncate">{receiptFile.name}</p>
                    <p className="text-xs text-text-muted">
                      {(receiptFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setReceiptFile(null)}
                  disabled={isSubmitting}
                >
                  Remove
                </Button>
              </div>
            )}
          </div>
        </FormField>
      </form>
    </Modal>
  );
};
