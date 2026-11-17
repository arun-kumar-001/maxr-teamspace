import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import type {
  CreateDesignationPayload,
  DepartmentOption,
  Designation,
  UpdateDesignationPayload,
} from '../types';

export interface DesignationModalProps {
  isOpen: boolean;
  designation: Designation | null; // null = Create, object = Edit
  departments: DepartmentOption[];
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateDesignationPayload | UpdateDesignationPayload) => Promise<void>;
}

const CODE_REGEX = /^[A-Za-z0-9_-]+$/;

export function DesignationModal({
  isOpen,
  designation,
  departments,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: DesignationModalProps) {
  const isEdit = Boolean(designation);

  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [errors, setErrors] = useState<{
    title?: string;
    code?: string;
    departmentId?: string;
  }>({});

  useEffect(() => {
    if (designation) {
      setTitle(designation.title);
      setCode(designation.code);
      setDepartmentId(designation.departmentId);
    } else {
      setTitle('');
      setCode('');
      // Default to first active department if available
      const firstActive = departments.find((d) => d.isActive);
      setDepartmentId(firstActive ? firstActive.id : '');
    }
    setErrors({});
  }, [designation, departments, isOpen]);

  const validate = (): boolean => {
    const nextErrors: {
      title?: string;
      code?: string;
      departmentId?: string;
    } = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      nextErrors.title = 'Designation title is required';
    } else if (trimmedTitle.length > 255) {
      nextErrors.title = 'Designation title cannot exceed 255 characters';
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      nextErrors.code = 'Designation code is required';
    } else if (trimmedCode.length > 50) {
      nextErrors.code = 'Designation code cannot exceed 50 characters';
    } else if (!CODE_REGEX.test(trimmedCode)) {
      nextErrors.code =
        'Designation code must contain only letters, numbers, underscores, or hyphens';
    }

    if (!departmentId.trim()) {
      nextErrors.departmentId = 'Department is required';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    await onSubmit({
      title: title.trim(),
      code: code.trim().toUpperCase(),
      departmentId: departmentId.trim(),
    });
  };

  // Build department dropdown options (only active departments for new creations, plus current for edits)
  const departmentSelectOptions = [
    { value: '', label: '-- Select Department --' },
    ...departments
      .filter((d) => d.isActive || (isEdit && d.id === designation?.departmentId))
      .map((d) => ({
        value: d.id,
        label: `${d.name}${!d.isActive ? ' - Inactive' : ''}`,
      })),
  ];

  const modalFooter = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isSubmitting}
        className="min-h-[44px]"
        data-testid="designation-modal-cancel"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="designation-form"
        variant="primary"
        disabled={isSubmitting}
        className="min-h-[44px]"
        data-testid="designation-modal-submit"
      >
        {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Designation'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Designation' : 'Create Designation'}
      footer={modalFooter}
      maxWidth="md"
    >
      <form
        id="designation-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
        data-testid="designation-form"
      >
        {serverError && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-xs rounded-card"
            role="alert"
            data-testid="designation-form-server-error"
          >
            {serverError}
          </div>
        )}

        <FormField
          label="Designation Title"
          htmlFor="designation-title-input"
          required
          error={errors.title}
          helperText="Official job title (e.g. Lead Engineer, HR Specialist)"
        >
          <Input
            id="designation-title-input"
            name="title"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
            }}
            placeholder="e.g. Senior Software Engineer"
            disabled={isSubmitting}
            className="min-h-[44px]"
            data-testid="designation-title-input"
          />
        </FormField>

        <FormField
          label="Designation Code"
          htmlFor="designation-code-input"
          required
          error={errors.code}
          helperText="Unique uppercase identifier (letters, numbers, hyphens, underscores)"
        >
          <Input
            id="designation-code-input"
            name="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
            }}
            placeholder="e.g. SR_SWE, HR_SPEC"
            disabled={isSubmitting}
            className="min-h-[44px] font-mono"
            data-testid="designation-code-input"
          />
        </FormField>

        <FormField
          label="Department"
          htmlFor="designation-department-select"
          required
          error={errors.departmentId}
          helperText="Organizational unit this role belongs to"
        >
          <Select
            id="designation-department-select"
            aria-label="Department"
            name="departmentId"
            options={departmentSelectOptions}
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              if (errors.departmentId) setErrors((prev) => ({ ...prev, departmentId: undefined }));
            }}
            disabled={isSubmitting}
            className="min-h-[44px]"
            data-testid="designation-department-input"
          />
        </FormField>
      </form>
    </Modal>
  );
}
