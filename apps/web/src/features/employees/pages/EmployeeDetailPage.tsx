import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import {
  Badge,
  Button,
  ErrorState,
  ForbiddenState,
  SegmentedControl,
  Skeleton,
} from '../../../components/ui';
import { DeactivateEmployeeModal } from '../components/DeactivateEmployeeModal';
import { EditEmployeeModal } from '../components/EditEmployeeModal';
import { EmployeeDocumentsTab } from '../components/EmployeeDocumentsTab';
import { useEmployeeDetail } from '../hooks/useEmployeeDetail';
import type { EmployeePatch } from '../types';

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { role, user } = useAuth();

  const { employee, isLoading, isSaving, error, isNotFound, isForbidden, refetch, updateEmployee } =
    useEmployeeDetail(id);

  const [activeTab, setActiveTab] = useState<'overview' | 'personal' | 'account' | 'documents'>(
    'overview',
  );
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isAdmin = role === 'admin';
  const isHR = role === 'hr_manager';
  const canEdit = (isAdmin || isHR) && employee?.status !== 'deactivated';
  const canDeactivate =
    isAdmin && employee?.status !== 'deactivated' && employee?.id !== user?.employeeId;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 4000);
  };

  const handleSave = async (patch: EmployeePatch) => {
    const result = await updateEmployee(patch);
    if (result.success) {
      showToast('Employee details updated successfully.');
    }
    return result;
  };

  const handleDeactivateSuccess = () => {
    showToast('Employee has been deactivated successfully.');
    refetch();
  };

  if (isLoading) {
    return (
      <div
        className="space-y-6 max-w-dashboard mx-auto p-4 sm:p-6"
        data-testid="employee-detail-loading"
      >
        <div className="flex items-center gap-3">
          <Skeleton className="w-24 h-8 rounded-md" />
        </div>
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-48 h-6" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
        </div>
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <Skeleton className="w-full h-48" />
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="p-4 sm:p-6 max-w-dashboard mx-auto" data-testid="employee-detail-forbidden">
        <ForbiddenState
          title="Access Restricted"
          message="You do not have permission to view this employee record."
          actionLabel="Back to Directory"
          onAction={() => navigate('/employees')}
        />
      </div>
    );
  }

  if (isNotFound || !employee) {
    return (
      <div className="p-4 sm:p-6 max-w-dashboard mx-auto" data-testid="employee-detail-not-found">
        <ErrorState
          title="Employee Not Found"
          message={
            error ||
            'The requested employee profile does not exist or you lack authorization to inspect this record.'
          }
          onRetry={() => navigate('/employees')}
        />
      </div>
    );
  }

  const initials = `${employee.firstName[0] || ''}${employee.lastName[0] || ''}`.toUpperCase();

  const statusVariant =
    employee.status === 'active'
      ? 'success'
      : employee.status === 'pending'
        ? 'warning'
        : 'neutral';

  const tabOptions: Array<{
    value: 'overview' | 'personal' | 'account' | 'documents';
    label: string;
  }> = [
    { value: 'overview', label: 'Job & Overview' },
    { value: 'personal', label: 'Personal Information' },
    ...(employee.account ? [{ value: 'account' as const, label: 'Account & Security' }] : []),
    { value: 'documents', label: 'Documents' },
  ];

  return (
    <div className="space-y-6 max-w-dashboard mx-auto" data-testid="employee-detail-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 p-4 bg-primary-deep text-white rounded-card shadow-raised flex items-center gap-3 text-sm animate-fade-in"
          data-testid="detail-toast"
        >
          <svg
            className="w-5 h-5 text-primary shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/employees')}
          className="min-h-[44px]"
          data-testid="back-to-directory-btn"
        >
          &larr; Back to Directory
        </Button>

        <div className="text-xs font-mono text-text-muted">
          Record Version: <span className="font-semibold text-text">v{employee.version}</span>
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary-soft text-primary-ink font-display font-bold text-xl sm:text-2xl flex items-center justify-center shrink-0 border border-primary/20 shadow-sm"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-text font-display truncate">
                {employee.firstName} {employee.lastName}
              </h1>
              <Badge variant={statusVariant}>
                {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-text-muted">
              <span className="font-mono bg-surface-muted px-2 py-0.5 rounded text-text font-medium border border-border">
                {employee.employeeCode}
              </span>
              <span>&bull;</span>
              <span>{employee.designation?.title || 'No Designation'}</span>
              <span>&bull;</span>
              <span>{employee.department?.name || 'No Department'}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {canEdit && (
            <Button
              variant="primary"
              onClick={() => setIsEditOpen(true)}
              className="min-h-[44px]"
              data-testid="edit-employee-btn"
            >
              <svg
                className="w-4 h-4 mr-1.5 stroke-current stroke-2 fill-none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit Employee
            </Button>
          )}

          {canDeactivate && (
            <Button
              variant="danger"
              onClick={() => setIsDeactivateOpen(true)}
              className="min-h-[44px]"
              data-testid="deactivate-employee-btn"
            >
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {/* Deactivated Notice Banner if applicable */}
      {employee.status === 'deactivated' && (
        <div
          className="p-4 bg-surface-muted border border-border rounded-input text-sm text-text-muted flex items-center gap-3"
          data-testid="deactivated-notice"
        >
          <svg
            className="w-5 h-5 text-text-subtle shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            This employee has been deactivated. Record details are locked in read-only mode.
          </span>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="overflow-x-auto max-w-full pb-1">
        <SegmentedControl
          options={tabOptions}
          value={activeTab}
          onChange={(val) => setActiveTab(val as typeof activeTab)}
          ariaLabel="Employee detail sections"
        />
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <div
          className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card space-y-6"
          data-testid="tab-overview"
        >
          <h2 className="text-base font-semibold text-text font-display">Employment Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Department</span>
              <p className="font-semibold text-text">
                {employee.department.name}{' '}
                {employee.department.code && (
                  <span className="text-xs font-mono font-normal text-text-muted">
                    ({employee.department.code})
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Designation</span>
              <p className="font-semibold text-text">
                {employee.designation.title}{' '}
                {employee.designation.code && (
                  <span className="text-xs font-mono font-normal text-text-muted">
                    ({employee.designation.code})
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Reporting Manager</span>
              <p className="font-semibold text-text">
                {employee.manager ? (
                  <span>
                    {employee.manager.firstName} {employee.manager.lastName}{' '}
                    <span className="text-xs font-mono font-normal text-text-muted">
                      ({employee.manager.employeeCode})
                    </span>
                  </span>
                ) : (
                  <span className="text-text-muted font-normal">
                    None (Direct Report / Executive)
                  </span>
                )}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Joining Date</span>
              <p className="font-semibold text-text">{employee.joiningDate}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Status</span>
              <div>
                <Badge variant={statusVariant}>
                  {employee.status.charAt(0).toUpperCase() + employee.status.slice(1)}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Record Version</span>
              <p className="font-mono text-text">v{employee.version}</p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Profile Created</span>
              <p className="text-text-muted text-xs">
                {employee.createdAt ? new Date(employee.createdAt).toLocaleString() : '—'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Last Modified</span>
              <p className="text-text-muted text-xs">
                {employee.updatedAt ? new Date(employee.updatedAt).toLocaleString() : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'personal' && (
        <div
          className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card space-y-6"
          data-testid="tab-personal"
        >
          <h2 className="text-base font-semibold text-text font-display">
            Personal & Contact Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Full Name</span>
              <p className="font-semibold text-text">
                {employee.firstName} {employee.lastName}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Work Email</span>
              <p>
                <a
                  href={`mailto:${employee.email}`}
                  className="font-medium text-primary-deep hover:underline"
                >
                  {employee.email}
                </a>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Contact Phone</span>
              <p>
                {employee.phone ? (
                  <a
                    href={`tel:${employee.phone}`}
                    className="font-medium text-text hover:text-primary-deep"
                  >
                    {employee.phone}
                  </a>
                ) : (
                  <span className="text-text-muted">Not provided</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'account' && employee.account && (
        <div
          className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card space-y-6"
          data-testid="tab-account"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text font-display">
              User Account & Security Access
            </h2>
            <span className="text-xs text-text-muted">Visible to HR & Admin only</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Sign-in Account ID</span>
              <p className="font-mono text-xs text-text break-all">
                {employee.account.userId || 'No linked user account'}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Account Status</span>
              <div>
                <Badge variant={employee.account.isActive ? 'success' : 'neutral'}>
                  {employee.account.isActive ? 'Active Login' : 'Disabled / Suspended'}
                </Badge>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-text-subtle font-medium block">Last Login</span>
              <p className="text-text">
                {employee.account.lastLoginAt
                  ? new Date(employee.account.lastLoginAt).toLocaleString()
                  : 'Never logged in'}
              </p>
            </div>

            <div className="sm:col-span-2 lg:col-span-3 space-y-2">
              <span className="text-xs text-text-subtle font-medium block">
                Assigned System Roles
              </span>
              <div className="flex flex-wrap gap-2">
                {employee.account.roles && employee.account.roles.length > 0 ? (
                  employee.account.roles.map((r) => (
                    <Badge key={r} variant="primary">
                      {r.replace('_', ' ').toUpperCase()}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-text-muted">No roles assigned</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'documents' && (
        <div
          className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card"
          data-testid="tab-documents"
        >
          <EmployeeDocumentsTab
            employeeId={employee.id}
            employeeName={`${employee.firstName} ${employee.lastName}`}
            canUpload={true}
            canDelete={isAdmin || isHR}
            canSetSensitive={isAdmin || isHR}
          />
        </div>
      )}

      {/* Edit Employee Modal */}
      {isEditOpen && (
        <EditEmployeeModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          employee={employee}
          onSave={handleSave}
          onReload={refetch}
          isAdmin={isAdmin}
          isSaving={isSaving}
        />
      )}

      {/* Deactivate Employee Modal */}
      {isDeactivateOpen && (
        <DeactivateEmployeeModal
          isOpen={isDeactivateOpen}
          onClose={() => setIsDeactivateOpen(false)}
          employee={{
            id: employee.id,
            employeeCode: employee.employeeCode,
            firstName: employee.firstName,
            lastName: employee.lastName,
            department: { name: employee.department.name },
            designation: { title: employee.designation.title },
          }}
          onSuccess={handleDeactivateSuccess}
        />
      )}
    </div>
  );
}

export default EmployeeDetailPage;
