import React, { useState, useEffect } from 'react';
import type { LeavePolicy, CreateLeavePolicyInput, UpdateLeavePolicyInput } from '../types';
import { Modal, Button, FormField } from '../../../components/ui';

export interface LeavePolicyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: LeavePolicy | null;
  onSubmit: (
    data: CreateLeavePolicyInput | (UpdateLeavePolicyInput & { id: string }),
  ) => Promise<void>;
}

export const LeavePolicyFormModal: React.FC<LeavePolicyFormModalProps> = ({
  isOpen,
  onClose,
  policy,
  onSubmit,
}) => {
  const isEditing = Boolean(policy);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [hasBalance, setHasBalance] = useState(true);
  const [annualDays, setAnnualDays] = useState(12);
  const [carryForwardMax, setCarryForwardMax] = useState(5);
  const [allowHalfDay, setAllowHalfDay] = useState(true);
  const [maxBackdateDays, setMaxBackdateDays] = useState(3);
  const [isActive, setIsActive] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (policy) {
      setCode(policy.code);
      setName(policy.name);
      setHasBalance(policy.hasBalance);
      setAnnualDays(policy.annualDays);
      setCarryForwardMax(policy.carryForwardMax);
      setAllowHalfDay(policy.allowHalfDay);
      setMaxBackdateDays(policy.maxBackdateDays);
      setIsActive(policy.isActive);
    } else {
      setCode('');
      setName('');
      setHasBalance(true);
      setAnnualDays(12);
      setCarryForwardMax(5);
      setAllowHalfDay(true);
      setMaxBackdateDays(3);
      setIsActive(true);
    }
    setError(null);
  }, [policy, isOpen]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }

    if (!isEditing) {
      const codeTrimmed = code.trim().toUpperCase();
      if (!/^[A-Z][A-Z0-9_]{1,29}$/.test(codeTrimmed)) {
        setError(
          'Policy code must start with a letter and contain only uppercase letters, numbers, and underscores (2-30 chars).',
        );
        return;
      }
    }

    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError('Policy name is required.');
      return;
    }

    const annual = Number(annualDays);
    const carry = Number(carryForwardMax);
    const backdate = Number(maxBackdateDays);

    if (hasBalance) {
      if (annual < 0 || annual > 366 || !Number.isInteger(annual * 2)) {
        setError('Annual days must be between 0 and 366 in whole or half steps (e.g. 12 or 12.5).');
        return;
      }
      if (carry < 0 || carry > 366 || !Number.isInteger(carry * 2)) {
        setError('Carry forward max must be between 0 and 366 in whole or half steps.');
        return;
      }
    } else {
      if (annual !== 0 || carry !== 0) {
        setError('Policies without balances must have 0 annual days and 0 carry forward.');
        return;
      }
    }

    if (backdate < 0 || backdate > 30 || !Number.isInteger(backdate)) {
      setError('Max backdate days must be an integer between 0 and 30.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (isEditing && policy) {
        await onSubmit({
          id: policy.id,
          name: nameTrimmed,
          isActive,
          annualDays: hasBalance ? annual : 0,
          carryForwardMax: hasBalance ? carry : 0,
          allowHalfDay,
          maxBackdateDays: backdate,
          version: policy.version,
        });
      } else {
        await onSubmit({
          code: code.trim().toUpperCase(),
          name: nameTrimmed,
          hasBalance,
          annualDays: hasBalance ? annual : 0,
          carryForwardMax: hasBalance ? carry : 0,
          allowHalfDay,
          maxBackdateDays: backdate,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save leave policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Edit Leave Policy: ${policy?.code}` : 'Create Leave Policy'}
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
            data-testid="submit-leave-policy-btn"
            className="min-h-[44px]"
          >
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Policy'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-2" data-testid="leave-policy-form">
        {error && (
          <div
            className="p-3 rounded-control bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="leave-policy-form-error"
          >
            {error}
          </div>
        )}

        {/* Policy Code */}
        <FormField
          label="Policy Code"
          htmlFor="leave-policy-code"
          required={!isEditing}
          helperText={
            isEditing
              ? 'Policy code is immutable once created.'
              : 'Short uppercase code, e.g. SICK, CASUAL, PTO, MATERNITY.'
          }
        >
          <input
            id="leave-policy-code"
            data-testid="leave-policy-code-input"
            type="text"
            disabled={isEditing || isSubmitting}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. SICK"
            maxLength={30}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text font-mono focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong disabled:bg-surface-muted disabled:text-text-muted h-11 min-h-[44px]"
            required={!isEditing}
          />
        </FormField>

        {/* Policy Name */}
        <FormField
          label="Policy Name"
          htmlFor="leave-policy-name"
          required
          helperText="Display name for employees and approvers."
        >
          <input
            id="leave-policy-name"
            data-testid="leave-policy-name-input"
            type="text"
            disabled={isSubmitting}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sick / Medical Leave"
            maxLength={100}
            className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            required
          />
        </FormField>

        {/* Has Balance Toggle */}
        <div className="flex items-center gap-3 p-3 rounded-tile bg-surface-muted border border-border">
          <input
            id="leave-policy-has-balance"
            data-testid="leave-policy-has-balance-toggle"
            type="checkbox"
            checked={hasBalance}
            disabled={isEditing || isSubmitting}
            onChange={(e) => {
              setHasBalance(e.target.checked);
              if (!e.target.checked) {
                setAnnualDays(0);
                setCarryForwardMax(0);
              } else {
                setAnnualDays(12);
                setCarryForwardMax(5);
              }
            }}
            className="h-5 w-5 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
          />
          <label
            htmlFor="leave-policy-has-balance"
            className="text-xs font-semibold text-text cursor-pointer select-none"
          >
            Track yearly balance and quota for this leave type
            <span className="block font-normal text-text-muted mt-0.5">
              Uncheck for unbounded leave types (such as bereavement, unpaid leave, or jury duty).
            </span>
          </label>
        </div>

        {/* Quota Fields */}
        {hasBalance && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              label="Annual Allotment"
              htmlFor="leave-policy-annual-days"
              helperText="Days per year (supports .5 increments)"
            >
              <input
                id="leave-policy-annual-days"
                data-testid="leave-policy-annual-input"
                type="number"
                min={0}
                max={366}
                step={0.5}
                disabled={isSubmitting}
                value={annualDays}
                onChange={(e) => setAnnualDays(Number(e.target.value))}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
              />
            </FormField>

            <FormField
              label="Carry Forward Max"
              htmlFor="leave-policy-carry-forward"
              helperText="Max unconsumed days rolled over into new year"
            >
              <input
                id="leave-policy-carry-forward"
                data-testid="leave-policy-carry-input"
                type="number"
                min={0}
                max={366}
                step={0.5}
                disabled={isSubmitting}
                value={carryForwardMax}
                onChange={(e) => setCarryForwardMax(Number(e.target.value))}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
              />
            </FormField>
          </div>
        )}

        {/* Half Day & Max Backdate */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          <FormField
            label="Max Backdate Allowed"
            htmlFor="leave-policy-backdate"
            helperText="Days in the past an employee can apply for leave (0-30)"
          >
            <input
              id="leave-policy-backdate"
              data-testid="leave-policy-backdate-input"
              type="number"
              min={0}
              max={30}
              step={1}
              disabled={isSubmitting}
              value={maxBackdateDays}
              onChange={(e) => setMaxBackdateDays(Number(e.target.value))}
              className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
            />
          </FormField>

          <div className="flex items-center gap-3 pt-6">
            <input
              id="leave-policy-half-day"
              data-testid="leave-policy-half-day-toggle"
              type="checkbox"
              checked={allowHalfDay}
              disabled={isSubmitting}
              onChange={(e) => setAllowHalfDay(e.target.checked)}
              className="h-5 w-5 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
            />
            <label
              htmlFor="leave-policy-half-day"
              className="text-xs font-semibold text-text cursor-pointer select-none"
            >
              Allow Half-Day Requests
            </label>
          </div>
        </div>

        {/* Active Toggle (Editing only) */}
        {isEditing && (
          <div className="flex items-center gap-3 p-3 rounded-tile bg-surface-muted border border-border">
            <input
              id="leave-policy-active"
              data-testid="leave-policy-active-toggle"
              type="checkbox"
              checked={isActive}
              disabled={isSubmitting}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-5 w-5 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
            />
            <label
              htmlFor="leave-policy-active"
              className="text-xs font-semibold text-text cursor-pointer select-none"
            >
              Policy Active & Selectable
              <span className="block font-normal text-text-muted mt-0.5">
                Deactivating a policy hides it from future leave applications while preserving
                historic balances.
              </span>
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
};
