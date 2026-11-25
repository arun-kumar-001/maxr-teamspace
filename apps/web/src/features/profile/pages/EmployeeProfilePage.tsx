import { useEffect, useState } from 'react';
import { uuidString } from '@maxr/shared';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ErrorState, ForbiddenState, Skeleton } from '../../../components/ui';
import { ChangeManagerModal } from '../../employees/components/ChangeManagerModal';
import { DeactivateEmployeeModal } from '../../employees/components/DeactivateEmployeeModal';
import { EditEmployeeModal } from '../../employees/components/EditEmployeeModal';
import { useEmployeeDetail } from '../../employees/hooks/useEmployeeDetail';
import { deleteEmployeePhoto, uploadEmployeePhoto } from '../../employees/api/photo';
import type { EmployeePatch } from '../../employees/types';
import { deleteMyPhoto, uploadMyPhoto } from '../api/profileApi';
import type { PhotoControls } from '../components/ProfileHeader';
import {
  UniversalEmployeeProfile,
  type ProfileActions,
} from '../components/UniversalEmployeeProfile';
import { useOwnPhone } from '../hooks/useOwnPhone';

/**
 * Both /profile/details (your own profile) and /profile/details/:id (anyone's) land here and show
 * the same page. The employee is read the same way for both: your own record is just the one whose
 * id is yours. Keyed by the employee id, so going from one profile to another starts clean instead
 * of showing the previous employee while the next one loads.
 */
export function EmployeeProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // An id in the link that is not a UUID can never be an employee (the API refuses it too), so say
  // so now instead of asking the server and showing whatever its refusal turns into.
  if (id !== undefined && !uuidString.safeParse(id).success) {
    return (
      <div className="space-y-6 w-full min-w-0" data-testid="employee-detail-not-found">
        <ErrorState
          title="Employee Not Found"
          message="This employee link is not valid. Open the employee from the directory instead."
          onRetry={() => navigate('/employees')}
        />
      </div>
    );
  }

  const employeeId = id ?? user?.employeeId;
  return <EmployeeProfileView key={employeeId} employeeId={employeeId} />;
}

function EmployeeProfileView({ employeeId }: { employeeId: string | undefined }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { role, user, updateUserAvatar } = useAuth();

  const { employee, isLoading, isSaving, error, isNotFound, isForbidden, refetch, updateEmployee } =
    useEmployeeDetail(employeeId);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [isChangeManagerOpen, setIsChangeManagerOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isSelf = Boolean(employee && employee.id === user?.employeeId);
  const isActive = employee?.status !== 'deactivated';
  const mayManage = role === 'admin' || role === 'hr_manager';
  const canEdit = mayManage && isActive;
  const canDeactivate = role === 'admin' && isActive && !isSelf;
  const canViewOrgChart = role === 'admin' || role === 'hr_manager' || role === 'team_lead';

  const ownPhone = useOwnPhone(
    {
      phone: employee?.phone ?? null,
      version: employee?.version ?? 0,
      status: employee?.status ?? 'active',
    },
    async () => {
      await refetch();
    },
  );

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage((current) => (current === message ? null : current)), 4000);
  };

  // The phone's own result (saved, unchanged) is shown like any other confirmation.
  const { successMessage: phoneMessage, clearMessages: clearPhoneMessages } = ownPhone;
  useEffect(() => {
    if (!phoneMessage) return;
    showToast(phoneMessage);
    clearPhoneMessages();
  }, [phoneMessage, clearPhoneMessages]);

  useEffect(() => {
    if (searchParams.get('edit') === 'true' && canEdit) setIsEditOpen(true);
  }, [searchParams, canEdit]);

  if (!employeeId) {
    return (
      <div className="space-y-6 w-full min-w-0" data-testid="employee-detail-not-found">
        <ErrorState
          title="Profile not available"
          message="Your sign-in is not linked to an employee record, so there is no profile to show."
        />
      </div>
    );
  }

  // Only the first load shows the skeleton; a reload after a save keeps the page on screen.
  if (isLoading && !employee) {
    return (
      <div className="space-y-6 w-full min-w-0" data-testid="employee-detail-loading">
        <div className="p-6 bg-surface border border-border rounded-card shadow-card space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="w-16 h-16 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="w-48 h-6" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="w-full h-48" />
          <Skeleton className="w-full h-48" />
        </div>
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="space-y-6 w-full min-w-0" data-testid="employee-detail-forbidden">
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
      <div className="space-y-6 w-full min-w-0" data-testid="employee-detail-not-found">
        <ErrorState
          title="Employee Not Found"
          message={
            error ||
            'The requested employee profile does not exist or you lack authorization to inspect this record.'
          }
          onRetry={isSelf ? () => void refetch() : () => navigate('/employees')}
        />
      </div>
    );
  }

  const handleSave = async (patch: EmployeePatch) => {
    const result = await updateEmployee(patch);
    if (result.success) showToast('Employee details updated successfully.');
    return result;
  };

  const actions: ProfileActions = {
    onEdit: canEdit ? () => setIsEditOpen(true) : undefined,
    onChangeManager: canEdit ? () => setIsChangeManagerOpen(true) : undefined,
    onDeactivate: canDeactivate ? () => setIsDeactivateOpen(true) : undefined,
    onOrgChart: canViewOrgChart ? () => navigate('/employees/org-chart') : undefined,
  };

  // A photo may be changed by the employee, or by Admin and HR for anyone who is not deactivated.
  const photo: PhotoControls | undefined =
    isActive && (isSelf || mayManage)
      ? {
          onUpload: async (file) => {
            if (isSelf) updateUserAvatar?.(await uploadMyPhoto(file));
            else await uploadEmployeePhoto(employee.id, file);
            await refetch();
          },
          onRemove: async () => {
            if (isSelf) {
              await deleteMyPhoto();
              updateUserAvatar?.(null);
            } else {
              await deleteEmployeePhoto(employee.id);
            }
            await refetch();
          },
        }
      : undefined;

  return (
    <div className="w-full min-w-0" data-testid="employee-detail-page">
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
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      <UniversalEmployeeProfile
        employee={employee}
        actions={actions}
        phone={isSelf ? ownPhone.state : undefined}
        photo={photo}
      />

      {isEditOpen && (
        <EditEmployeeModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          employee={employee}
          onSave={handleSave}
          onReload={refetch}
          isAdmin={role === 'admin'}
          isSaving={isSaving}
        />
      )}

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
          onSuccess={() => {
            showToast('Employee has been deactivated successfully.');
            void refetch();
          }}
        />
      )}

      {isChangeManagerOpen && (
        <ChangeManagerModal
          isOpen={isChangeManagerOpen}
          onClose={() => setIsChangeManagerOpen(false)}
          employee={{
            id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            employeeCode: employee.employeeCode,
            version: employee.version,
            manager: employee.manager
              ? {
                  id: employee.manager.id,
                  name: `${employee.manager.firstName} ${employee.manager.lastName}`,
                  employeeCode: employee.manager.employeeCode,
                }
              : null,
          }}
          onSuccess={() => {
            showToast('Reporting manager updated successfully.');
            void refetch();
          }}
        />
      )}
    </div>
  );
}

export default EmployeeProfilePage;
