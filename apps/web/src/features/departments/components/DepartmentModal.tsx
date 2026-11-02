import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import type { CreateDepartmentPayload, Department, UpdateDepartmentPayload } from '../types';

export interface DepartmentModalProps {
  isOpen: boolean;
  department: Department | null; // null = Create, object = Edit
  isSubmitting: boolean;
  serverError: string | null;
  onClose: () => void;
  onSubmit: (payload: CreateDepartmentPayload | UpdateDepartmentPayload) => Promise<void>;
}

const CODE_REGEX = /^[A-Za-z0-9_-]+$/;

export function DepartmentModal({
  isOpen,
  department,
  isSubmitting,
  serverError,
  onClose,
  onSubmit,
}: DepartmentModalProps) {
  const isEdit = Boolean(department);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<{ name?: string; code?: string }>({});

  useEffect(() => {
    if (department) {
      setName(department.name);
      setCode(department.code);
    } else {
      setName('');
      setCode('');
    }
    setErrors({});
  }, [department, isOpen]);

  const validate = (): boolean => {
    const nextErrors: { name?: string; code?: string } = {};

    const trimmedName = name.trim();
    if (!trimmedName) {
      nextErrors.name = 'Department name is required';
    } else if (trimmedName.length > 255) {
      nextErrors.name = 'Department name cannot exceed 255 characters';
    }

    const trimmedCode = code.trim();
    if (!trimmedCode) {
      nextErrors.code = 'Department code is required';
    } else if (trimmedCode.length > 50) {
      nextErrors.code = 'Department code cannot exceed 50 characters';
    } else if (!CODE_REGEX.test(trimmedCode)) {
      nextErrors.code =
        'Department code must contain only letters, numbers, underscores, or hyphens';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate() || isSubmitting) return;

    await onSubmit({
      name: name.trim(),
      code: code.trim().toUpperCase(),
    });
  };

  const modalFooter = (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={onClose}
        disabled={isSubmitting}
        className="min-h-[44px]"
        data-testid="department-modal-cancel"
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form="department-form"
        variant="primary"
        disabled={isSubmitting}
        className="min-h-[44px]"
        data-testid="department-modal-submit"
      >
        {isSubmitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Department'}
      </Button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Department' : 'Create Department'}
      footer={modalFooter}
      maxWidth="md"
    >
      <form
        id="department-form"
        onSubmit={handleSubmit}
        className="space-y-4"
        noValidate
        data-testid="department-form"
      >
        {serverError && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-xs rounded-card"
            role="alert"
            data-testid="department-form-server-error"
          >
            {serverError}
          </div>
        )}

        <FormField
          label="Department Name"
          htmlFor="department-name-input"
          required
          error={errors.name}
          helperText="Full descriptive title of the department (max 255 characters)"
        >
          <Input
            id="department-name-input"
            name="name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="e.g. Engineering, People Operations"
            disabled={isSubmitting}
            className="min-h-[44px]"
            data-testid="department-name-input"
          />
        </FormField>

        <FormField
          label="Department Code"
          htmlFor="department-code-input"
          required
          error={errors.code}
          helperText="Unique uppercase identifier (letters, numbers, hyphens, underscores)"
        >
          <Input
            id="department-code-input"
            name="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              if (errors.code) setErrors((prev) => ({ ...prev, code: undefined }));
            }}
            placeholder="e.g. ENG, HR, FIN"
            disabled={isSubmitting}
            className="min-h-[44px] font-mono"
            data-testid="department-code-input"
          />
        </FormField>
      </form>
    </Modal>
  );
}
