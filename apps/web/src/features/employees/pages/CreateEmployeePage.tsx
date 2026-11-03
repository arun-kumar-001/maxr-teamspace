import { useNavigate } from 'react-router-dom';
import { ForbiddenState } from '../../../components/ui';
import { useAuth } from '../../../auth/AuthContext';
import { useCreateEmployee } from '../hooks/useCreateEmployee';
import { CreateEmployeeForm } from '../components/CreateEmployeeForm';
import { CreateEmployeeSuccessView } from '../components/CreateEmployeeSuccessView';

export function CreateEmployeePage() {
  const navigate = useNavigate();

  let userRole = null;
  try {
    const auth = useAuth();
    userRole = auth.role;
  } catch {
    // Isolated tests without AuthProvider
  }

  const isAuthorized = userRole === 'admin' || userRole === 'hr_manager';

  const formProps = useCreateEmployee({
    callerRole: userRole ?? 'admin',
  });

  if (!isAuthorized && userRole !== null) {
    return (
      <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto" data-testid="create-employee-page">
        <div data-testid="create-employee-forbidden">
          <ForbiddenState
            title="Access Restricted"
            message="Only Administrators and HR Managers have permission to register new workforce members."
            actionLabel="Back to Employee Directory"
            onAction={() => navigate('/employees')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto" data-testid="create-employee-page">
      {/* Header Banner & Breadcrumb */}
      <div className="space-y-2 border-b border-border pb-4">
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
          <button
            type="button"
            onClick={() => navigate('/employees')}
            className="hover:text-primary-ink transition-colors font-medium cursor-pointer"
            data-testid="breadcrumb-directory-link"
          >
            Employee Directory
          </button>
          <span className="text-border-strong select-none">/</span>
          <span className="text-text font-semibold" aria-current="page">
            Add New Employee
          </span>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text font-display">
              Add New Employee
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              Create an employee record, inactive user account, and queue onboarding atomically.
            </p>
          </div>

          {!formProps.createdEmployee && (
            <button
              type="button"
              onClick={() => navigate('/employees')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text px-3 py-1.5 rounded-input border border-border bg-surface hover:bg-surface-muted transition-colors self-start sm:self-auto min-h-[36px]"
              data-testid="back-to-directory-button"
            >
              <svg
                className="w-4 h-4 stroke-current stroke-2 fill-none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
              Directory
            </button>
          )}
        </div>
      </div>

      {/* Main Content: Success View OR Creation Form */}
      {formProps.createdEmployee ? (
        <CreateEmployeeSuccessView
          createdEmployee={formProps.createdEmployee}
          onViewDirectory={() => navigate('/employees')}
          onCreateAnother={formProps.resetForm}
        />
      ) : (
        <CreateEmployeeForm {...formProps} onCancel={() => navigate('/employees')} />
      )}
    </div>
  );
}
