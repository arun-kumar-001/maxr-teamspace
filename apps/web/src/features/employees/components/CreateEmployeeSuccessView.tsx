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
