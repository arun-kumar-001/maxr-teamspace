import { useState } from 'react';
import { Button, StatusPill } from '../../../components/ui';
import type { CreatedEmployee } from '../types';

export interface CreateEmployeeSuccessViewProps {
  createdEmployee: CreatedEmployee;
  onViewDirectory: () => void;
  onCreateAnother: () => void;
}

export function CreateEmployeeSuccessView({
  createdEmployee,
  onViewDirectory,
  onCreateAnother,
}: CreateEmployeeSuccessViewProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const secret = createdEmployee.tempCredential || createdEmployee.temporaryPassword;

  const handleCopyPassword = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };
  return (
    <div
      className="p-6 sm:p-8 bg-surface border border-border rounded-card shadow-card space-y-6 max-w-2xl mx-auto"
      data-testid="create-employee-success-view"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <svg
            className="w-6 h-6 stroke-current stroke-2 fill-none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-bold text-text font-display">
            Employee Created Successfully
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            The employee record and inactive user account have been created atomically.
          </p>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-surface-muted border border-border rounded-input p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border pb-3">
          <div>
            <p className="text-base font-bold text-text">
              {createdEmployee.firstName} {createdEmployee.lastName}
            </p>
            <p className="text-xs font-mono text-text-muted">{createdEmployee.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-surface px-2.5 py-1 rounded border border-border font-semibold text-text">
              {createdEmployee.employeeCode}
            </span>
            <StatusPill status="Pending" size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-text-subtle font-semibold uppercase tracking-wider block text-[10px]">
              Assigned Role
            </span>
            <span className="capitalize font-medium text-text mt-0.5 block">
              {createdEmployee.role.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-text-subtle font-semibold uppercase tracking-wider block text-[10px]">
              Joining Date
            </span>
            <span className="font-medium text-text mt-0.5 block font-mono">
              {createdEmployee.joiningDate}
            </span>
          </div>
        </div>
      </div>

      {/* Account Sign-in Credentials Card */}
      {secret && (
        <div
          className="p-4 bg-primary-soft/40 border border-primary-strong/30 rounded-input space-y-2.5"
          data-testid="credentials-card"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-primary-deep flex items-center gap-1.5">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Account Initial Password
            </span>
            <span className="text-[10px] font-semibold text-primary-ink bg-primary-soft px-2 py-0.5 rounded-full border border-primary/30">
              Provisioned
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={secret}
                readOnly
                className="w-full pl-3 pr-10 py-2 bg-surface border border-border rounded-xl text-xs sm:text-sm font-mono text-text select-all"
                data-testid="success-password-input"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-text cursor-pointer transition-colors"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                data-testid="success-toggle-password-btn"
              >
                {showPassword ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopyPassword}
              className="px-3.5 py-2 rounded-xl border border-border bg-surface hover:bg-surface-raised text-xs font-semibold text-text flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 shadow-2xs"
              data-testid="success-copy-password-btn"
            >
              {copied ? (
                <>
                  <span className="text-emerald-600 font-bold">✓</span>
                  <span className="text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-text-muted">
            Share this initial password securely with the employee. Administrators can also view or copy it anytime from <span className="font-semibold text-text">Users &amp; Access</span>.
          </p>
        </div>
      )}

      {/* Onboarding Notice & Credential Policy */}
      <div
        className="p-4 bg-sky-50 border border-sky-200 rounded-input space-y-2 text-xs text-sky-950"
        role="region"
        aria-label="Account Activation Policy"
      >
        <div className="flex items-center gap-2 font-semibold text-sky-900">
          <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
              clipRule="evenodd"
            />
          </svg>
          Account Inactive Pending Onboarding
        </div>
        <p className="text-sky-900/90 leading-relaxed">
          Employee created successfully. A welcome email has been queued for{' '}
          <span className="font-mono font-medium">{createdEmployee.email}</span>. Account access
          remains <span className="font-semibold">inactive</span> until onboarding is completed.
        </p>
        <p className="text-sky-900/80 leading-relaxed">
          No password or activation link has been issued at this stage. The set-password invitation
          happens separately through the onboarding workflow after the required onboarding steps.
        </p>
      </div>

      {/* Navigation Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <Button
          type="button"
          variant="primary"
          onClick={onViewDirectory}
          className="w-full sm:w-auto min-h-[44px]"
          data-testid="view-directory-button"
        >
          View in Directory
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onCreateAnother}
          className="w-full sm:w-auto min-h-[44px]"
          data-testid="create-another-button"
        >
          Add Another Employee
        </Button>
      </div>
    </div>
  );
}
