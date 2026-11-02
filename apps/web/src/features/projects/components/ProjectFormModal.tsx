import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import type {
  CreateProjectInput,
  ProjectDetail,
  ProjectStatus,
  UpdateProjectInput,
} from '../types';

export interface ProjectFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialProject?: ProjectDetail | null;
  onSubmitCreate?: (input: CreateProjectInput) => Promise<unknown>;
  onSubmitEdit?: (input: Omit<UpdateProjectInput, 'version'>) => Promise<unknown>;
}

export function ProjectFormModal({
  isOpen,
  onClose,
  mode,
  initialProject,
  onSubmitCreate,
  onSubmitEdit,
}: ProjectFormModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('active');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setServerError(null);
      setErrors({});
      if (mode === 'edit' && initialProject) {
        setCode(initialProject.code);
        setName(initialProject.name);
        setDescription(initialProject.description ?? '');
        setStartDate(initialProject.startDate ?? '');
        setEndDate(initialProject.endDate ?? '');
        setStatus(initialProject.status);
      } else {
        setCode('');
        setName('');
        setDescription('');
        setStartDate('');
        setEndDate('');
        setStatus('active');
      }
    }
  }, [isOpen, mode, initialProject]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (mode === 'create') {
      const codeRegex = /^[A-Z][A-Z0-9_-]{1,19}$/;
      const upperCode = code.trim().toUpperCase();
      if (!upperCode) {
        newErrors.code = 'Project code is required';
      } else if (!codeRegex.test(upperCode)) {
        newErrors.code =
          'Code must be 2-20 characters (letters, digits, - or _), starting with a letter';
      }
    }

    if (!name.trim()) {
      newErrors.name = 'Project name is required';
    } else if (name.trim().length > 150) {
      newErrors.name = 'Name must be 150 characters or less';
    }

    if (description.trim().length > 1000) {
      newErrors.description = 'Description must be 1000 characters or less';
    }

    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      newErrors.startDate = 'Use format YYYY-MM-DD';
    }

    if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      newErrors.endDate = 'Use format YYYY-MM-DD';
    }

    if (startDate && endDate && endDate < startDate) {
      newErrors.endDate = 'End date must be on or after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) return;
        const input: CreateProjectInput = {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };
        await onSubmitCreate(input);
      } else {
        if (!onSubmitEdit) return;
        const input: Omit<UpdateProjectInput, 'version'> = {
          name: name.trim(),
          description: description.trim() || null,
          status,
          startDate: startDate || null,
          endDate: endDate || null,
        };
        await onSubmitEdit(input);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Failed to save project. Please check the details and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCreate = mode === 'create';
  const modalTitle = isCreate ? 'Create New Project' : 'Edit Project';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="outline" onClick={onClose} disabled={submitting} type="button">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting}
            type="submit"
            data-testid="submit-project-btn"
          >
            {submitting ? 'Saving...' : isCreate ? 'Create Project' : 'Save Changes'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-1">
        {serverError && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg"
            role="alert"
          >
            {serverError}
          </div>
        )}

        {isCreate ? (
          <FormField
            label="Project Code"
            htmlFor="project-code"
            required
            error={errors.code}
            helperText="Uppercase identifier (e.g. PRJ-ALPHA, TEAM-OPS). 2-20 characters."
          >
            <Input
              id="project-code"
              placeholder="e.g. PRJ-ALPHA"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              disabled={submitting}
              autoFocus
            />
          </FormField>
        ) : (
          <div className="flex items-center justify-between p-3 bg-surface-muted rounded-card border border-border">
            <span className="text-xs uppercase font-semibold text-text-subtle">Project Code</span>
            <span className="font-mono text-sm font-semibold text-text">{code}</span>
          </div>
        )}

        <FormField label="Project Name" htmlFor="project-name" required error={errors.name}>
          <Input
            id="project-name"
            placeholder="e.g. Mobile App Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="project-description"
          error={errors.description}
          helperText="Optional context or objectives (up to 1000 characters)"
        >
          <textarea
            id="project-description"
            rows={3}
            className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:bg-surface-muted disabled:text-text-muted"
            placeholder="Describe the purpose, scope, or goals of this project..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Start Date" htmlFor="project-start-date" error={errors.startDate}>
            <Input
              id="project-start-date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <FormField label="End Date" htmlFor="project-end-date" error={errors.endDate}>
            <Input
              id="project-end-date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={submitting}
            />
          </FormField>
        </div>

        {!isCreate && (
          <FormField label="Status" htmlFor="project-status">
            <Select
              id="project-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ProjectStatus)}
              disabled={submitting}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}
