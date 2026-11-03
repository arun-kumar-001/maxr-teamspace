import { useEffect, useState } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { Badge, Button, Modal } from '../../../components/ui';
import { useUserRoles } from '../hooks/useUserRoles';
import type { UserAccount } from '../types';

export interface RoleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserAccount | null;
  onSuccess?: (user: UserAccount) => void;
}

const AVAILABLE_ROLES: Array<{
  role: Role;
  name: string;
  description: string;
}> = [
  {
    role: ROLES.ADMIN,
    name: 'Admin',
    description: 'Company-wide control: user accounts, security, audit logs, and settings.',
  },
  {
    role: ROLES.HR_MANAGER,
    name: 'HR Manager',
    description: 'Workforce scope: employees, onboarding/offboarding, leave/attendance policy.',
  },
  {
    role: ROLES.TEAM_LEAD,
    name: 'Team Lead',
    description: 'Team scope: approvals, team attendance, task management, team reports.',
  },
  {
    role: ROLES.STAFF,
    name: 'Staff',
    description: 'Self records: personal profile, check-in/out, leave requests, own tasks.',
  },
];

export function RoleAssignmentModal({
  isOpen,
  onClose,
  user,
  onSuccess,
}: RoleAssignmentModalProps) {
  const { updateRoles, isUpdating, error, statusCode, reset } = useUserRoles();
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync selected roles when user changes
  useEffect(() => {
    if (user) {
      setSelectedRoles([...user.roles]);
      setValidationError(null);
      reset();
    }
  }, [user, reset]);

  if (!user) return null;

  const handleToggleRole = (role: Role) => {
    setValidationError(null);
    setSelectedRoles((prev) => {
      if (prev.includes(role)) {
        return prev.filter((r) => r !== role);
      } else {
        return [...prev, role];
      }
    });
  };

  const handleSave = async () => {
    if (selectedRoles.length === 0) {
      setValidationError('An account must have at least one role assigned.');
      return;
    }

    try {
      const updated = await updateRoles(user.id, selectedRoles);
      onSuccess?.(updated);
      onClose();
    } catch {
      // Error handled by hook state (especially 422 last-admin)
      // Form remains open for correction
    }
  };

  const handleClose = () => {
    if (isUpdating) return;
    reset();
    onClose();
  };

  const isLastAdminError = statusCode === 422;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Manage Roles" maxWidth="md">
      <div className="p-4 sm:p-6 space-y-5" data-testid="role-assignment-modal">
        {/* User context card */}
        <div className="p-3 bg-surface-muted border border-border rounded-tile flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text text-sm">{user.name}</span>
              <span className="text-xs font-mono text-text-subtle">({user.employeeCode})</span>
            </div>
            <p className="text-xs text-text-muted">{user.email}</p>
          </div>
          <Badge variant={user.isActive ? 'success' : 'neutral'}>
            {user.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Error Callout (Last Admin 422 or generic error) */}
        {error && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 rounded-tile text-xs text-rose-800 space-y-1"
            data-testid="role-assignment-error"
            role="alert"
          >
            <div className="font-semibold flex items-center gap-1.5">
              <span>{isLastAdminError ? 'Last Admin Protection' : 'Role Update Refused'}</span>
            </div>
            <p>{error}</p>
            {isLastAdminError && (
              <p className="text-rose-700 text-[11px]">
                Please ensure the account retains the Admin role or promote another active account
                first.
              </p>
            )}
          </div>
        )}

        {/* Validation error (0 roles selected) */}
        {validationError && (
          <div
            className="p-2.5 bg-amber-50 border border-amber-200 rounded-tile text-xs text-amber-800"
            data-testid="role-validation-error"
          >
            {validationError}
          </div>
        )}

        {/* Roles Checkbox List */}
        <div>
          <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
            Assign Roles (1 to 4)
          </label>
          <div className="space-y-2.5" data-testid="role-checkbox-list">
            {AVAILABLE_ROLES.map(({ role, name, description }) => {
              const isChecked = selectedRoles.includes(role);
              return (
                <label
                  key={role}
                  className={`flex items-start gap-3 p-3 rounded-tile border cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-primary-soft/40 border-primary-strong/40'
                      : 'bg-surface border-border hover:bg-surface-muted'
                  }`}
                  data-testid={`role-option-${role}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleRole(role)}
                    disabled={isUpdating}
                    className="mt-0.5 w-4 h-4 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
                    data-testid={`role-checkbox-${role}`}
                  />
                  <div className="text-xs space-y-0.5">
                    <div className="font-semibold text-text">{name}</div>
                    <div className="text-text-muted">{description}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        {/* Modal actions */}
        <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={handleClose}
            disabled={isUpdating}
            data-testid="cancel-role-assignment-btn"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={handleSave}
            disabled={isUpdating || selectedRoles.length === 0}
            data-testid="save-role-assignment-btn"
          >
            {isUpdating ? 'Saving Roles...' : 'Save Roles'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
