import { useEffect, useId, useState } from 'react';
import { Button, FormField, Input, Modal, Select } from '../../../components/ui';
import { fetchActiveDepartments, fetchDesignationsByDepartment } from '../api/creation';
import type {
  DepartmentSelectOption,
  DesignationSelectOption,
  EmployeeDetail,
  EmployeePatch,
} from '../types';

export interface EditEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: EmployeeDetail;
  onSave: (patch: EmployeePatch) => Promise<{
    success: boolean;
    error?: string;
    statusCode?: number;
    details?: unknown;
  }>;
  onReload: () => Promise<void>;
  isAdmin: boolean;
  isSaving?: boolean;
}

export function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  onSave,
  onReload,
  isAdmin,
  isSaving = false,
}: EditEmployeeModalProps) {
  const formId = useId();

  // Form field states
  const [firstName, setFirstName] = useState(employee.firstName);
  const [lastName, setLastName] = useState(employee.lastName);
  const [employeeCode, setEmployeeCode] = useState(employee.employeeCode);
  const [email, setEmail] = useState(employee.email);
  const [phone, setPhone] = useState(employee.phone || '');
  const [joiningDate, setJoiningDate] = useState(employee.joiningDate);
  const [departmentId, setDepartmentId] = useState(employee.department.id);
  const [designationId, setDesignationId] = useState(employee.designation.id);

  // Reference options
  const [departments, setDepartments] = useState<DepartmentSelectOption[]>([]);
  const [designations, setDesignations] = useState<DesignationSelectOption[]>([]);
  const [isLoadingRefs, setIsLoadingRefs] = useState(false);

  // Errors & conflict
  const [localError, setLocalError] = useState<string | null>(null);
  const [localFieldErrors, setLocalFieldErrors] = useState<Record<string, string>>({});
  const [isConflict, setIsConflict] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  // Synchronize state when employee changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setFirstName(employee.firstName);
      setLastName(employee.lastName);
      setEmployeeCode(employee.employeeCode);
      setEmail(employee.email);
      setPhone(employee.phone || '');
      setJoiningDate(employee.joiningDate);
      setDepartmentId(employee.department.id);
      setDesignationId(employee.designation.id);
      setLocalError(null);
      setLocalFieldErrors({});
      setIsConflict(false);
    }
  }, [isOpen, employee]);

  // Load active departments
  useEffect(() => {
    if (!isOpen) return;
    let mounted = true;
    setIsLoadingRefs(true);
    fetchActiveDepartments()
      .then((depts) => {
        if (!mounted) return;
        setDepartments(depts);
        // Ensure current employee's department is in the list
        if (!depts.some((d) => d.id === employee.department.id)) {
          setDepartments([
            {
              id: employee.department.id,
              name: employee.department.name,
              code: employee.department.code,
            },
            ...depts,
          ]);
        }
      })
      .finally(() => {
        if (mounted) setIsLoadingRefs(false);
      });
    return () => {
      mounted = false;
    };
  }, [isOpen, employee.department]);

  // Load designations when departmentId changes
  useEffect(() => {
    if (!isOpen || !departmentId) {
      setDesignations([]);
      return;
    }
    let mounted = true;
    fetchDesignationsByDepartment(departmentId).then((desigs) => {
      if (!mounted) return;
      setDesignations(desigs);
      // Ensure current designation is in list if matching department
      if (
        departmentId === employee.department.id &&
        !desigs.some((d) => d.id === employee.designation.id)
      ) {
        setDesignations([
          {
            id: employee.designation.id,
            title: employee.designation.title,
            code: employee.designation.code,
            departmentId: employee.department.id,
          },
          ...desigs,
        ]);
      }
    });
    return () => {
      mounted = false;
    };
  }, [isOpen, departmentId, employee.department.id, employee.designation]);

  const handleDepartmentChange = (newDeptId: string) => {
    setDepartmentId(newDeptId);
    // If department changed, reset designation unless it matches employee's original
    if (newDeptId === employee.department.id) {
      setDesignationId(employee.designation.id);
    } else {
      setDesignationId('');
    }
  };

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await onReload();
      setIsConflict(false);
      setLocalError(null);
      setLocalFieldErrors({});
    } finally {
      setIsReloading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalFieldErrors({});
    setIsConflict(false);

    // Build diff patch
    const patch: EmployeePatch = {};
    const errors: Record<string, string> = {};

    if (!firstName.trim()) {
      errors.firstName = 'First name is required';
    } else if (firstName.trim() !== employee.firstName) {
      patch.firstName = firstName.trim();
    }

    if (!lastName.trim()) {
      errors.lastName = 'Last name is required';
    } else if (lastName.trim() !== employee.lastName) {
      patch.lastName = lastName.trim();
    }

    if (isAdmin) {
      if (!employeeCode.trim()) {
        errors.employeeCode = 'Employee code is required';
      } else if (employeeCode.trim() !== employee.employeeCode) {
        patch.employeeCode = employeeCode.trim();
      }

      if (!email.trim()) {
        errors.email = 'Email address is required';
      } else if (email.trim().toLowerCase() !== employee.email.toLowerCase()) {
        patch.email = email.trim().toLowerCase();
      }
    }

    const trimmedPhone = phone.trim();
    const originalPhone = employee.phone || '';
    if (trimmedPhone !== originalPhone) {
      patch.phone = trimmedPhone === '' ? null : trimmedPhone;
    }

    if (!joiningDate) {
      errors.joiningDate = 'Joining date is required';
    } else if (joiningDate !== employee.joiningDate) {
      patch.joiningDate = joiningDate;
    }

    const deptChanged = departmentId !== employee.department.id;
    const desigChanged = designationId !== employee.designation.id;

    if (deptChanged) {
      patch.departmentId = departmentId;
      if (!designationId) {
        errors.designationId = 'Select a designation for the new department';
      } else {
        patch.designationId = designationId;
      }
    } else if (desigChanged) {
      patch.designationId = designationId;
    }

    if (Object.keys(errors).length > 0) {
      setLocalFieldErrors(errors);
      return;
    }

    if (Object.keys(patch).length === 0) {
      setLocalError('No fields have been changed.');
      return;
    }

    const result = await onSave(patch);
    if (result.success) {
      onClose();
    } else {
      if (result.statusCode === 409) {
        setIsConflict(true);
        setLocalError(
          result.error ||
            'This employee record was modified by another session. Please reload to review the latest changes.',
        );
      } else {
        setLocalError(result.error || 'Failed to update employee details.');
      }
    }
  };

  const hasChanges =
    firstName.trim() !== employee.firstName ||
    lastName.trim() !== employee.lastName ||
    (isAdmin && employeeCode.trim() !== employee.employeeCode) ||
    (isAdmin && email.trim().toLowerCase() !== employee.email.toLowerCase()) ||
    phone.trim() !== (employee.phone || '') ||
    joiningDate !== employee.joiningDate ||
    departmentId !== employee.department.id ||
    designationId !== employee.designation.id;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Employee — ${employee.firstName} ${employee.lastName}`}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSaving || isReloading}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            disabled={!hasChanges || isSaving || isReloading || isConflict}
            isLoading={isSaving}
            className="min-h-[44px]"
            data-testid="save-employee-button"
          >
            Save Changes
          </Button>
        </div>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
        {/* Version Badge & Info */}
        <div className="flex items-center justify-between p-3 bg-surface-muted rounded-input text-xs text-text-muted border border-border">
          <span className="font-mono">Record Version: v{employee.version}</span>
          <span>Optimistic locking active</span>
        </div>

        {/* Conflict Alert Banner */}
        {isConflict && (
          <div
            className="p-4 bg-amber-50 border border-amber-200 rounded-input text-amber-900 space-y-3"
            data-testid="conflict-alert"
          >
            <div className="flex items-start gap-3">
              <svg
                className="w-5 h-5 text-amber-600 shrink-0 mt-0.5"
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
              <div className="text-sm">
                <p className="font-semibold text-amber-950">Concurrent Update Conflict (409)</p>
                <p className="mt-1 text-xs text-amber-800">
                  {localError ||
                    'Someone else modified this employee record while you were editing. Reloading will fetch the latest version.'}
                </p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleReload}
                isLoading={isReloading}
                className="min-h-[44px] bg-white border-amber-300 text-amber-900 hover:bg-amber-100"
                data-testid="reload-latest-button"
              >
                Reload Latest Version
              </Button>
            </div>
          </div>
        )}

        {/* General Error Banner */}
        {localError && !isConflict && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 rounded-input text-rose-800 text-sm"
            data-testid="edit-error-banner"
          >
            {localError}
          </div>
        )}

        {/* Identity & Contact Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="First Name"
            htmlFor="edit-first-name"
            required
            error={localFieldErrors.firstName}
          >
            <Input
              id="edit-first-name"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              disabled={isSaving || isReloading}
              error={localFieldErrors.firstName}
              data-testid="edit-first-name-input"
            />
          </FormField>

          <FormField
            label="Last Name"
            htmlFor="edit-last-name"
            required
            error={localFieldErrors.lastName}
          >
            <Input
              id="edit-last-name"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              disabled={isSaving || isReloading}
              error={localFieldErrors.lastName}
              data-testid="edit-last-name-input"
            />
          </FormField>
        </div>

        {/* Code & Email (Admin Only editable, HR read-only) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Employee Code"
            htmlFor="edit-employee-code"
            required={isAdmin}
            error={localFieldErrors.employeeCode}
            helperText={!isAdmin ? 'Only Administrators can change employee codes.' : undefined}
          >
            <Input
              id="edit-employee-code"
              type="text"
              value={employeeCode}
              onChange={(e) => setEmployeeCode(e.target.value)}
              disabled={!isAdmin || isSaving || isReloading}
              readOnly={!isAdmin}
              error={localFieldErrors.employeeCode}
              data-testid="edit-employee-code-input"
            />
          </FormField>

          <FormField
            label="Work Email"
            htmlFor="edit-email"
            required={isAdmin}
            error={localFieldErrors.email}
            helperText={!isAdmin ? 'Only Administrators can change work emails.' : undefined}
          >
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isAdmin || isSaving || isReloading}
              readOnly={!isAdmin}
              error={localFieldErrors.email}
              data-testid="edit-email-input"
            />
          </FormField>
        </div>

        {/* Phone & Joining Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Contact Phone"
            htmlFor="edit-phone"
            error={localFieldErrors.phone}
            helperText="Optional (+, -, spaces, and digits)"
          >
            <Input
              id="edit-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1-555-0100"
              disabled={isSaving || isReloading}
              error={localFieldErrors.phone}
              data-testid="edit-phone-input"
            />
          </FormField>

          <FormField
            label="Joining Date"
            htmlFor="edit-joining-date"
            required
            error={localFieldErrors.joiningDate}
          >
            <Input
              id="edit-joining-date"
              type="date"
              value={joiningDate}
              onChange={(e) => setJoiningDate(e.target.value)}
              disabled={isSaving || isReloading}
              error={localFieldErrors.joiningDate}
              data-testid="edit-joining-date-input"
            />
          </FormField>
        </div>

        {/* Department and Designation Selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border">
          <FormField
            label="Department"
            htmlFor="edit-department"
            required
            error={localFieldErrors.departmentId}
            helperText="Changing department requires choosing a valid designation."
          >
            <Select
              id="edit-department"
              value={departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              disabled={isSaving || isReloading || isLoadingRefs}
              options={departments.map((d) => ({
                value: d.id,
                label: d.code ? `${d.name} (${d.code})` : d.name,
              }))}
              data-testid="edit-department-select"
            />
          </FormField>

          <FormField
            label="Designation"
            htmlFor="edit-designation"
            required
            error={localFieldErrors.designationId}
          >
            <Select
              id="edit-designation"
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
              disabled={isSaving || isReloading || designations.length === 0}
              placeholder="Select designation..."
              options={designations.map((des) => ({
                value: des.id,
                label: des.code ? `${des.title} (${des.code})` : des.title,
              }))}
              data-testid="edit-designation-select"
            />
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
