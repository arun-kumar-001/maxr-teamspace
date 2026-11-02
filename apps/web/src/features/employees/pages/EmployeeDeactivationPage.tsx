import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Badge, Button, ErrorState, ForbiddenState, Skeleton } from '../../../components/ui';
import { apiFetch } from '../../../api/client';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import type { DeactivationResult } from '../types/deactivation';

interface EmployeeDetail {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  status: string;
  email?: string;
  department?: { name: string };
  designation?: { title: string };
}

export function EmployeeDeactivationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deactivationResult, setDeactivationResult] = useState<DeactivationResult | null>(null);

  const isAdmin = role === 'admin';
  const isSelf = user?.employeeId === id;

  useEffect(() => {
    if (!id || !isAdmin || isSelf) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    const fetchEmployee = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiFetch(`/api/v1/employees/${encodeURIComponent(id)}`);
        if (!res.ok) {
          throw new Error(
            res.status === 404
              ? 'Employee not found'
              : `Failed to load employee details (${res.status})`,
          );
        }
        const json = (await res.json()) as { data: EmployeeDetail };
        if (isMounted) {
          setEmployee(json.data);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load employee');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchEmployee();
    return () => {
      isMounted = false;
    };
  }, [id, isAdmin, isSelf]);

  if (!isAdmin) {
    return (
      <div className="p-4 sm:p-6" data-testid="deactivation-page-forbidden">
        <ForbiddenState
          title="Access Restricted"
          message="Only System Administrators have permission to deactivate employee accounts."
        />
      </div>
    );
  }

  if (isSelf) {
    return (
      <div className="p-4 sm:p-6" data-testid="deactivation-page-self">
        <ForbiddenState
          title="Self-Deactivation Not Permitted"
          message="You cannot deactivate your own account. Ask another Administrator to perform this action if necessary."
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div
        className="p-4 sm:p-6 space-y-4 max-w-2xl mx-auto"
        data-testid="deactivation-page-loading"
      >
        <Skeleton height={32} width="50%" />
        <Skeleton height={140} />
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-4 sm:p-6 max-w-2xl mx-auto" data-testid="deactivation-page-error">
        <ErrorState
          title="Cannot Access Deactivation"
          message={error || 'Employee record not found'}
          onRetry={() => navigate('/admin/employees')}
        />
      </div>
    );
  }

  const isAlreadyDeactivated =
    employee.status === 'deactivated' || deactivationResult?.status === 'deactivated';

  return (
    <div
      className="p-4 sm:p-6 max-w-2xl mx-auto space-y-6"
      data-testid="employee-deactivation-page"
    >
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => navigate('/admin/employees')}>
          &larr; Back to Directory
        </Button>
      </div>

      <div className="p-6 bg-surface rounded-card border border-border shadow-card space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Employee Deactivation
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Review and offboard workforce members with immediate session revocation.
            </p>
          </div>
          <Badge variant={isAlreadyDeactivated ? 'neutral' : 'success'}>
            {isAlreadyDeactivated ? 'Deactivated' : 'Active'}
          </Badge>
        </div>

        {/* Employee Summary Card */}
        <div className="p-4 bg-surface-muted rounded-tile border border-border grid grid-cols-2 gap-3 text-xs sm:text-sm">
          <div>
            <span className="text-text-subtle block text-xs">Name</span>
            <span className="font-semibold text-text">
              {employee.firstName} {employee.lastName}
            </span>
          </div>
          <div>
            <span className="text-text-subtle block text-xs">Employee Code</span>
            <span className="font-mono font-medium text-text">{employee.employeeCode}</span>
          </div>
          <div>
            <span className="text-text-subtle block text-xs">Department</span>
            <span className="text-text">{employee.department?.name || '—'}</span>
          </div>
          <div>
            <span className="text-text-subtle block text-xs">Designation</span>
            <span className="text-text">{employee.designation?.title || '—'}</span>
          </div>
        </div>

        {isAlreadyDeactivated ? (
          <div className="p-4 bg-neutral-100 border border-neutral-300 rounded-tile text-xs sm:text-sm text-text space-y-2">
            <div className="font-semibold text-text">Account is Already Deactivated</div>
            <p className="text-text-muted">
              This employee is currently in deactivated status. Their sign-in account is disabled
              and no further deactivation action is required.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-tile text-amber-900 text-xs sm:text-sm space-y-2">
              <div className="font-bold flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-amber-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                Confirmation Warning
              </div>
              <p className="text-amber-800">
                Deactivating {employee.firstName} {employee.lastName} will immediately disable their
                login account and revoke all active sessions. This action cannot be reversed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                variant="danger"
                size="md"
                onClick={() => setIsModalOpen(true)}
                data-testid="start-deactivation-btn"
              >
                Proceed with Deactivation
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <DeactivateEmployeeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={employee}
        onSuccess={(res) => {
          setDeactivationResult(res);
          setEmployee((prev) => (prev ? { ...prev, status: 'deactivated' } : null));
        }}
      />
    </div>
  );
}

export default EmployeeDeactivationPage;
