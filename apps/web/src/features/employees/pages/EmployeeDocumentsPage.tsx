import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { Button, ForbiddenState } from '../../../components/ui';
import { EmployeeDocumentsTab } from '../components/EmployeeDocumentsTab';

export function EmployeeDocumentsPage() {
  const { user, role } = useAuth();
  const params = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // If path is /staff/documents, target employee is the user's own employee ID
  const activeEmployeeId = params.id || user?.employeeId;

  const isAdminOrHR = role === 'admin' || role === 'hr_manager';
  const isStaff = role === 'staff';
  const isOwnRecord = user?.employeeId === activeEmployeeId;

  if (!activeEmployeeId) {
    return (
      <div className="p-4 sm:p-6" data-testid="documents-page-no-employee">
        <ForbiddenState
          title="Profile Not Found"
          message="No associated employee profile was found for this user account."
        />
      </div>
    );
  }

  // Deny Team Lead or Staff trying to view another's documents
  if (!isAdminOrHR && (!isStaff || !isOwnRecord)) {
    return (
      <div className="p-4 sm:p-6" data-testid="documents-page-forbidden">
        <ForbiddenState
          title="Access Restricted"
          message="You do not have permission to view employee personal documents."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="employee-documents-page">
      {/* Back button when accessed via employee detail */}
      {params.id && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(-1)}>
            &larr; Back
          </Button>
        </div>
      )}

      <div className="p-4 sm:p-6 bg-surface rounded-card border border-border shadow-card">
        <EmployeeDocumentsTab
          employeeId={activeEmployeeId}
          employeeName={isOwnRecord ? 'My' : undefined}
          canUpload={true}
          canDelete={isAdminOrHR}
          canSetSensitive={isAdminOrHR}
        />
      </div>
    </div>
  );
}

export default EmployeeDocumentsPage;

