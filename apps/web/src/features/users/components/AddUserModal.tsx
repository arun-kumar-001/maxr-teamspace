import { useEffect, useState, type FormEvent } from 'react';
import { ROLES, type Role } from '@maxr/shared';
import { Badge, Button, FormField, Input, Modal } from '../../../components/ui';
import { createUser, UsersApiError } from '../api/usersApi';
import type { UserAccount } from '../types';

export interface AddUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (user: UserAccount) => void;
}

const ROLE_OPTIONS: Array<{
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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AddUserModal({ isOpen, onClose, onCreated }: AddUserModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<Role[]>([ROLES.STAFF]);
  const [isActive, setIsActive] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    user: UserAccount;
    temporaryPassword: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
      setSelectedRoles([ROLES.STAFF]);
      setIsActive(true);
      setFieldErrors({});
      setApiError(null);
      setIsSubmitting(false);
      setCreatedResult(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleToggleRole = (role: Role) => {
    setFieldErrors((prev) => ({ ...prev, roles: '' }));
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  };

  const handleCopyPassword = async () => {
    if (!createdResult?.temporaryPassword || typeof navigator === 'undefined') return;
    try {
      await navigator.clipboard?.writeText(createdResult.temporaryPassword);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!firstName.trim()) nextErrors.firstName = 'First name is required.';
    if (!lastName.trim()) nextErrors.lastName = 'Last name is required.';
    if (!email.trim()) {
      nextErrors.email = 'Work email is required.';
    } else if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (password.trim() && password.trim().length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }
    if (selectedRoles.length === 0) {
      nextErrors.roles = 'Select at least one role.';
    }
    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const trimmedPassword = password.trim();
      const res = await createUser({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        roles: selectedRoles,
        isActive,
        ...(trimmedPassword ? { password: trimmedPassword } : {}),
      });

      onCreated?.(res.user);
      if (res.temporaryPassword) {
        setCreatedResult({ user: res.user, temporaryPassword: res.temporaryPassword });
      } else {
        onClose();
      }
    } catch (err) {
      if (err instanceof UsersApiError) {
        setApiError(err.message);
      } else {
        setApiError(err instanceof Error ? err.message : 'Failed to create user account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Create User Account" maxWidth="md">
      {createdResult ? (
        <div className="p-4 sm:p-6 space-y-5" data-testid="add-user-success">
          <div className="p-4 rounded-tile bg-primary-soft/50 border border-primary-strong/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-text">{createdResult.user.name}</span>
              <Badge variant={createdResult.user.isActive ? 'success' : 'neutral'}>
                {createdResult.user.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-xs text-text-muted">{createdResult.user.email}</p>
            <p className="text-xs text-text-subtle font-mono">
              Code: {createdResult.user.employeeCode}
            </p>
          </div>

          <div className="p-4 rounded-tile bg-surface-muted border border-border space-y-2">
            <span className="block text-xs font-semibold uppercase tracking-wider text-text-muted">
              Generated Temporary Password
            </span>
            <p className="text-xs text-text-muted">
              Share this credential securely with the user. It will not be displayed again.
            </p>
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-input bg-surface border border-border">
              <code
                className="text-sm font-mono font-semibold text-text select-all"
                data-testid="generated-temp-password"
              >
                {createdResult.temporaryPassword}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyPassword}
                data-testid="copy-temp-password-btn"
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-border flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleClose}
              data-testid="add-user-done-btn"
            >
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4" data-testid="add-user-modal">
          {apiError && (
            <div
              className="p-3 rounded-tile bg-rose-50 border border-rose-200 text-xs text-rose-800"
              role="alert"
              data-testid="add-user-error"
            >
              {apiError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <FormField
              label="First Name"
              htmlFor="add-user-first-name"
              required
              error={fieldErrors.firstName}
            >
              <Input
                id="add-user-first-name"
                value={firstName}
                onChange={(e) => {
                  setFirstName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, firstName: '' }));
                }}
                placeholder="e.g. Nadia"
                disabled={isSubmitting}
                error={fieldErrors.firstName ? ' ' : undefined}
              />
            </FormField>

            <FormField
              label="Last Name"
              htmlFor="add-user-last-name"
              required
              error={fieldErrors.lastName}
            >
              <Input
                id="add-user-last-name"
                value={lastName}
                onChange={(e) => {
                  setLastName(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, lastName: '' }));
                }}
                placeholder="e.g. Roy"
                disabled={isSubmitting}
                error={fieldErrors.lastName ? ' ' : undefined}
              />
            </FormField>
          </div>

          <FormField label="Work Email" htmlFor="add-user-email" required error={fieldErrors.email}>
            <Input
              id="add-user-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: '' }));
              }}
              placeholder="nadia.roy@maxr.internal"
              disabled={isSubmitting}
              error={fieldErrors.email ? ' ' : undefined}
            />
          </FormField>

          <FormField
            label="Initial Password (Optional)"
            htmlFor="add-user-password"
            helperText="Leave blank to auto-generate a secure temporary password."
            error={fieldErrors.password}
          >
            <Input
              id="add-user-password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: '' }));
              }}
              placeholder="Minimum 8 characters"
              disabled={isSubmitting}
              error={fieldErrors.password ? ' ' : undefined}
            />
          </FormField>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">
              Assign Roles (1 to 4) <span className="text-danger">*</span>
            </label>
            {fieldErrors.roles && (
              <p className="mb-2 text-xs text-danger" role="alert">
                {fieldErrors.roles}
              </p>
            )}
            <div className="space-y-2">
              {ROLE_OPTIONS.map(({ role, name, description }) => {
                const isChecked = selectedRoles.includes(role);
                return (
                  <label
                    key={role}
                    className={`flex items-start gap-3 p-3 rounded-tile border cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-primary-soft/40 border-primary-strong/40'
                        : 'bg-surface border-border hover:bg-surface-muted'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleRole(role)}
                      disabled={isSubmitting}
                      className="mt-0.5 w-4 h-4 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
                      data-testid={`add-user-role-${role}`}
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

          <label className="flex items-center gap-2.5 pt-1 text-xs text-text cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSubmitting}
              className="w-4 h-4 rounded border-border-strong text-primary-deep focus:ring-primary-strong"
              data-testid="add-user-active-checkbox"
            />
            <span className="font-medium">Activate account immediately for sign-in</span>
          </label>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={isSubmitting}
              data-testid="submit-add-user-btn"
            >
              {isSubmitting ? 'Creating User...' : 'Create User'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
