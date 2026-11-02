import { useState } from 'react';
import { Badge, Button, ErrorState, Skeleton } from '../../../components/ui';
import {
  activateEmployee,
  completeEmployeeStep,
  generateSetPasswordToken,
  reopenOnboarding,
  unverifyOnboardingItem,
  verifyOnboardingItem,
} from '../api/onboarding';
import { useOnboardingDetail } from '../hooks/useOnboarding';
import type { OnboardingItem, OnboardingStep } from '../types/onboarding';
import { OnboardingItemRow } from './OnboardingItemRow';
import { OnboardingStepBadge } from './OnboardingStepBadge';

export interface OnboardingChecklistDetailProps {
  employeeId: string;
  onBack: () => void;
  userRole: string;
  isOwnRecord?: boolean;
}

const STEP_ORDER: ('hr' | 'system' | 'it_admin' | 'employee')[] = [
  'hr',
  'system',
  'it_admin',
  'employee',
];

const STEP_LABELS: Record<'hr' | 'system' | 'it_admin' | 'employee', string> = {
  hr: 'HR Setup',
  system: 'System Access',
  it_admin: 'IT / Admin',
  employee: 'Employee Setup',
};

export function OnboardingChecklistDetail({
  employeeId,
  onBack,
  userRole,
  isOwnRecord = false,
}: OnboardingChecklistDetailProps) {
  const { detail, isLoading, error, refetch, setDetail } = useOnboardingDetail(employeeId);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{ link: string; expiresAt: string } | null>(
    null,
  );
  const [showReopenInput, setShowReopenInput] = useState(false);
  const [reopenReason, setReopenReason] = useState('');

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="onboarding-detail-loading">
        <Skeleton height={36} width={120} />
        <div className="space-y-2">
          <Skeleton height={28} width="40%" />
          <Skeleton height={16} width="20%" />
        </div>
        <Skeleton height={80} variant="rectangular" />
        <Skeleton height={200} variant="rectangular" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4 sm:p-6 space-y-6" data-testid="onboarding-detail-error">
        <Button size="sm" variant="outline" onClick={onBack}>
          &larr; Back to Onboarding
        </Button>
        <ErrorState
          title="Failed to Load Checklist"
          message={error || 'Onboarding checklist not found.'}
          onRetry={refetch}
        />
      </div>
    );
  }

  const isAdminOrHR = userRole === 'admin' || userRole === 'hr_manager';
  const isCompleted = detail.status === 'completed';

  const handleVerify = async (itemKey: string, notes?: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const updated = await verifyOnboardingItem(employeeId, itemKey, { notes });
      setDetail(updated);
      setActionSuccess(`Item ${itemKey} verified.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to verify item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnverify = async (itemKey: string) => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const updated = await unverifyOnboardingItem(employeeId, itemKey);
      setDetail(updated);
      setActionSuccess(`Item ${itemKey} unverified.`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to unverify item.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateToken = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const res = await generateSetPasswordToken(employeeId);
      const link = `${window.location.origin}/set-password?token=${res.token}`;
      setGeneratedLink({ link, expiresAt: res.expiresAt });
      setActionSuccess('Set-password link generated and queued via email.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to generate link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivate = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      await activateEmployee(employeeId);
      setActionSuccess('Employee account activated successfully! The user may now log in.');
      await refetch();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to activate account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopen = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const updated = await reopenOnboarding(employeeId, reopenReason || undefined);
      setDetail(updated);
      setShowReopenInput(false);
      setReopenReason('');
      setActionSuccess('Onboarding workflow reopened.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to reopen onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmployeeStepComplete = async () => {
    setActionError(null);
    setActionSuccess(null);
    setIsSubmitting(true);
    try {
      const updated = await completeEmployeeStep(employeeId);
      setDetail(updated);
      setActionSuccess('Employee step verified successfully.');
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to complete employee step.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canVerifyItem = (item: OnboardingItem): boolean => {
    if (isCompleted) return false;

    // Must be in current step
    if (item.step !== detail.currentStep) return false;

    if (item.step === 'hr' || item.step === 'system') {
      return isAdminOrHR;
    }
    if (item.step === 'it_admin') {
      return isAdminOrHR;
    }
    if (item.step === 'employee') {
      return isOwnRecord || isAdminOrHR;
    }
    return false;
  };

  const canUnverifyItem = (): boolean => {
    return isAdminOrHR;
  };

  const getStepStatus = (step: 'hr' | 'system' | 'it_admin' | 'employee') => {
    if (detail.status === 'completed') return 'completed';

    const stepIndex = STEP_ORDER.indexOf(step);
    const currentIndex = STEP_ORDER.indexOf(
      detail.currentStep as 'hr' | 'system' | 'it_admin' | 'employee',
    );

    if (currentIndex === -1 || stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  return (
    <div className="space-y-6" data-testid="onboarding-checklist-detail">
      {/* Top Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button size="sm" variant="outline" onClick={onBack}>
          &larr; Back
        </Button>
        <div className="flex items-center gap-2">
          {isCompleted ? (
            <Badge variant="success">Account Active</Badge>
          ) : (
            <Badge variant="warning">In Progress</Badge>
          )}
          <OnboardingStepBadge step={detail.currentStep} />
        </div>
      </div>

      {/* Header Info */}
      <div className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              {detail.firstName} {detail.lastName}
            </h1>
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-muted text-text-muted">
              {detail.employeeCode}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-text-muted mt-1">
            {detail.designationTitle} &bull; {detail.departmentName} &bull; {detail.email}
          </p>
        </div>

        {/* Global Action Buttons for HR/Admin */}
        {isAdminOrHR && (
          <div className="flex flex-wrap items-center gap-2">
            {!isCompleted && (
              <Button
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                onClick={handleGenerateToken}
              >
                Send Password Link
              </Button>
            )}

            {!isCompleted && detail.currentStep === 'employee' && (
              <Button size="sm" variant="primary" isLoading={isSubmitting} onClick={handleActivate}>
                Activate Account
              </Button>
            )}

            {isCompleted && !showReopenInput && (
              <Button
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                onClick={() => setShowReopenInput(true)}
              >
                Reopen Onboarding
              </Button>
            )}
          </div>
        )}

        {isOwnRecord && !isCompleted && detail.currentStep === 'employee' && (
          <Button
            size="sm"
            variant="primary"
            isLoading={isSubmitting}
            onClick={handleEmployeeStepComplete}
          >
            Complete My Onboarding Step
          </Button>
        )}
      </div>

      {/* Reopen prompt */}
      {showReopenInput && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-tile space-y-3">
          <p className="text-xs sm:text-sm font-semibold text-amber-900">
            Reopening will revoke employee access and set status back to pending.
          </p>
          <input
            type="text"
            className="w-full px-3 py-2 text-xs sm:text-sm bg-surface rounded-control border border-border text-text focus:ring-2 focus:ring-primary-strong"
            placeholder="Reason for reopening (optional)..."
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setShowReopenInput(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" isLoading={isSubmitting} onClick={handleReopen}>
              Confirm Reopen
            </Button>
          </div>
        </div>
      )}

      {/* Generated Token Alert */}
      {generatedLink && (
        <div className="p-4 bg-primary-soft border border-primary-soft-border rounded-tile space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary-ink uppercase tracking-wider">
              Set-Password Link (Valid 72 Hours)
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(generatedLink.link);
                setActionSuccess('Link copied to clipboard!');
              }}
            >
              Copy Link
            </Button>
          </div>
          <p className="text-xs font-mono text-text break-all bg-surface p-2 rounded border border-border">
            {generatedLink.link}
          </p>
        </div>
      )}

      {/* Messages */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-tile flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button
            type="button"
            className="text-emerald-700 font-bold ml-2"
            onClick={() => setActionSuccess(null)}
          >
            &times;
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-tile flex items-center justify-between">
          <span>{actionError}</span>
          <button
            type="button"
            className="text-rose-700 font-bold ml-2"
            onClick={() => setActionError(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Step Progress Stepper */}
      <div className="p-4 sm:p-6 bg-surface rounded-card border border-border">
        <h2 className="text-sm font-bold text-text mb-4">Onboarding Milestones</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {STEP_ORDER.map((step, idx) => {
            const status = getStepStatus(step);
            return (
              <div
                key={step}
                className={`p-3 rounded-tile border flex items-center gap-3 ${
                  status === 'completed'
                    ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                    : status === 'active'
                      ? 'bg-primary-soft border-primary-strong/40 text-primary-ink ring-2 ring-primary-strong/20'
                      : 'bg-surface-muted border-border text-text-muted opacity-75'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                    status === 'completed'
                      ? 'bg-emerald-600 text-white'
                      : status === 'active'
                        ? 'bg-primary-strong text-white'
                        : 'bg-border text-text-muted'
                  }`}
                >
                  {status === 'completed' ? '✓' : idx + 1}
                </div>
                <div>
                  <div className="font-semibold text-xs sm:text-sm">{STEP_LABELS[step]}</div>
                  <div className="text-[11px] text-text-subtle capitalize">{status}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Items Grouped by Step */}
      <div className="space-y-6">
        {STEP_ORDER.map((step) => {
          const stepItems = detail.items.filter((item) => item.step === step);
          if (stepItems.length === 0) return null;

          const isCurrentStep = detail.currentStep === step;

          return (
            <div
              key={step}
              className={`p-4 sm:p-6 bg-surface rounded-card border ${
                isCurrentStep ? 'border-primary-strong/30 shadow-card' : 'border-border'
              } space-y-4`}
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-text">{STEP_LABELS[step]}</h3>
                  <span className="text-xs text-text-muted">
                    ({stepItems.filter((i) => i.isVerified).length}/{stepItems.length} verified)
                  </span>
                </div>
                <OnboardingStepBadge step={step as OnboardingStep} />
              </div>

              <div className="space-y-3">
                {stepItems.map((item) => (
                  <OnboardingItemRow
                    key={item.id}
                    item={item}
                    canVerify={canVerifyItem(item)}
                    canUnverify={canUnverifyItem()}
                    onVerify={handleVerify}
                    onUnverify={handleUnverify}
                    isSubmitting={isSubmitting}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
