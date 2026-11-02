import { Badge, Button, Modal } from '../../../components/ui';
import { useEmployeeDeactivation } from '../hooks/useEmployeeDeactivation';
import type { DeactivationResult } from '../types/deactivation';

export interface DeactivateEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: {
    id: string;
    employeeCode: string;
    firstName: string;
    lastName: string;
    department?: { name: string };
    designation?: { title: string };
  } | null;
  onSuccess?: (result: DeactivationResult) => void;
}

export function DeactivateEmployeeModal({
  isOpen,
  onClose,
  employee,
  onSuccess,
}: DeactivateEmployeeModalProps) {
  const { deactivate, isDeactivating, result, error, reset } = useEmployeeDeactivation();

  if (!employee) return null;

  const handleClose = () => {
    if (isDeactivating) return;
    if (result) {
      onSuccess?.(result);
    }
    reset();
    onClose();
  };

  const handleConfirmDeactivate = async () => {
    try {
      await deactivate(employee.id);
    } catch {
      // Error handled by hook state
    }
  };

  const fullName = `${employee.firstName} ${employee.lastName}`.trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={result ? 'Employee Deactivated' : 'Deactivate Employee'}
      footer={
        result ? (
          <div className="flex items-center justify-end w-full">
            <Button
              variant="primary"
              size="md"
              onClick={handleClose}
              data-testid="deactivation-done-btn"
            >
              Done
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-end gap-3 w-full">
            <Button
              variant="ghost"
              size="md"
              disabled={isDeactivating}
              onClick={handleClose}
              data-testid="cancel-deactivation-btn"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              isLoading={isDeactivating}
              onClick={handleConfirmDeactivate}
              data-testid="confirm-deactivation-btn"
            >
              Deactivate Employee
            </Button>
          </div>
        )
      }
    >
      <div className="p-4 sm:p-6 space-y-4" data-testid="deactivate-employee-modal">
        {/* Error State */}
        {error && (
          <div
            className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-input font-medium"
            role="alert"
            data-testid="deactivation-error-alert"
          >
            {error}
          </div>
        )}

        {/* Confirmation State */}
        {!result ? (
          <div className="space-y-4">
            <div className="p-4 rounded-tile bg-surface-muted border border-border space-y-1">
              <div className="text-xs text-text-subtle font-medium">Target Employee</div>
              <div className="text-sm sm:text-base font-semibold text-text">
                {fullName}{' '}
                <span className="font-mono text-xs text-text-muted">({employee.employeeCode})</span>
              </div>
              {(employee.department || employee.designation) && (
                <div className="text-xs text-text-muted">
                  {[employee.designation?.title, employee.department?.name]
                    .filter(Boolean)
                    .join(' • ')}
                </div>
              )}
            </div>

            {/* Critical Warning Callout */}
            <div
              className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-tile space-y-2 text-xs sm:text-sm"
              role="alert"
            >
              <div className="flex items-center gap-2 font-bold text-amber-900">
                <svg
                  className="w-5 h-5 text-amber-700 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>Warning: Irreversible Account Deactivation</span>
              </div>
              <ul className="list-disc pl-5 space-y-1 text-xs text-amber-800">
                <li>The user&apos;s sign-in account will be switched off immediately.</li>
                <li>All active login sessions across all devices will be instantly terminated.</li>
                <li>
                  Historical records (attendance, documents, leave) are safely preserved for
                  compliance.
                </li>
                <li>This action cannot be undone via the API.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* Post-Deactivation Summary State */
          <div className="space-y-4" data-testid="deactivation-summary">
            {/* Success Status Banner */}
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-tile space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold">
                    ✓
                  </div>
                  <span className="font-semibold text-sm sm:text-base text-emerald-900">
                    {result.alreadyDeactivated ? 'Already Deactivated' : 'Successfully Deactivated'}
                  </span>
                </div>
                <Badge variant="neutral">Deactivated</Badge>
              </div>
              <p className="text-xs text-emerald-800">
                {result.alreadyDeactivated
                  ? `${fullName} was already in deactivated status. Active sessions were re-checked and invalidated.`
                  : `${fullName} has been deactivated. Active login sessions have been revoked.`}
              </p>
              <div className="flex items-center gap-4 text-xs font-mono text-emerald-700 pt-1">
                <span>Sessions ended: {result.sessionsRevoked}</span>
                <span>Time: {new Date(result.deactivatedAt).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Direct Reports Warning Callout */}
            {result.directReports && result.directReports.length > 0 ? (
              <div
                className="p-4 bg-rose-50 border border-rose-200 rounded-tile space-y-3"
                data-testid="direct-reports-warning"
              >
                <div className="flex items-start gap-2">
                  <svg
                    className="w-5 h-5 text-rose-600 shrink-0 mt-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-rose-900">
                      Action Required: {result.directReports.length} Direct Report
                      {result.directReports.length === 1 ? '' : 's'} Without Active Manager
                    </h4>
                    <p className="text-xs text-rose-800 mt-0.5">
                      The following employees reported to {fullName} and now require a new manager
                      assignment in the reporting hierarchy:
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-rose-200 bg-white/70 rounded-input border border-rose-200 overflow-hidden max-h-48 overflow-y-auto">
                  {result.directReports.map((report) => (
                    <div
                      key={report.id}
                      className="px-3 py-2 flex items-center justify-between text-xs"
                      data-testid={`direct-report-${report.id}`}
                    >
                      <span className="font-medium text-text">{report.name}</span>
                      <span className="font-mono text-text-muted">{report.employeeCode}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      handleClose();
                      if (typeof window !== 'undefined') {
                        window.location.href = '/admin/employees';
                      }
                    }}
                    className="text-xs"
                  >
                    Go to Employee Directory to Reassign Managers
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="p-3 bg-surface-muted border border-border rounded-tile text-xs text-text-muted"
                data-testid="no-direct-reports"
              >
                No direct reports were affected by this deactivation.
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
