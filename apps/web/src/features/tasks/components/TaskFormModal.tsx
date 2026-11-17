import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { fetchProjects } from '../../projects/api/projectsApi';
import type { Project } from '../../projects/types';
import type { CreateTaskInput, Task, TaskPriority, UpdateTaskInput } from '../types';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialTask?: Task | null;
  defaultAssigneeId?: string;
  defaultProjectId?: string;
  onSubmitCreate?: (input: CreateTaskInput) => Promise<unknown>;
  onSubmitEdit?: (input: Omit<UpdateTaskInput, 'version'>) => Promise<unknown>;
}

export function TaskFormModal({
  isOpen,
  onClose,
  mode,
  initialTask,
  defaultAssigneeId,
  defaultProjectId,
  onSubmitCreate,
  onSubmitEdit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [isDaily, setIsDaily] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setServerError(null);
    setErrors({});

    if (mode === 'edit' && initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description ?? '');
      setPriority(initialTask.priority);
      setDueDate(initialTask.dueDate ?? '');
      setProjectId(initialTask.projectId ?? '');
      setAssigneeId(initialTask.assigneeEmployeeId);
      setIsDaily(Boolean(initialTask.isDaily));
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setProjectId(defaultProjectId ?? '');
      setAssigneeId(defaultAssigneeId ?? '');
      setIsDaily(false);
    }

    // Load available projects and employees for dropdowns
    void fetchProjects({ status: 'active', pageSize: 100 })
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]));

    void fetchEmployeeDirectory({ status: 'active', pageSize: 100 })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]));
  }, [isOpen, mode, initialTask, defaultAssigneeId, defaultProjectId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.trim().length > 200) {
      newErrors.title = 'Title must be 200 characters or less';
    }

    if (description.trim().length > 2000) {
      newErrors.description = 'Description must be 2000 characters or less';
    }

    if (!assigneeId) {
      newErrors.assigneeId = 'Please select an assignee';
    }

    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      newErrors.dueDate = 'Use YYYY-MM-DD';
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
        const input: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeEmployeeId: assigneeId,
          priority,
          dueDate: dueDate || undefined,
          projectId: projectId || undefined,
          isDaily,
        };
        await onSubmitCreate(input);
      } else {
        if (!onSubmitEdit) return;
        const input: Omit<UpdateTaskInput, 'version'> = {
          title: title.trim(),
          description: description.trim() || null,
          assigneeEmployeeId: assigneeId,
          priority,
          dueDate: dueDate || null,
          projectId: projectId || null,
          isDaily,
        };
        await onSubmitEdit(input);
      }
      onClose();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('Failed to save task.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isCreate = mode === 'create';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreate ? 'Create New Task' : 'Edit Task'}
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
            data-testid="submit-task-btn"
          >
            {submitting ? 'Saving...' : isCreate ? 'Create Task' : 'Save Changes'}
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

        <FormField label="Task Title" htmlFor="task-title" required error={errors.title}>
          <Input
            id="task-title"
            placeholder="e.g. Implement user export CSV"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </FormField>

        <FormField
          label="Description"
          htmlFor="task-description"
          error={errors.description}
          helperText="Optional details or criteria for this task"
        >
          <textarea
            id="task-description"
            rows={3}
            className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:bg-surface-muted"
            placeholder="Provide context, acceptance criteria or links..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Assignee" htmlFor="task-assignee" required error={errors.assigneeId}>
            <Select
              id="task-assignee"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              disabled={submitting}
              options={[
                { value: '', label: 'Select Team Member' },
                ...employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.firstName} ${emp.lastName} (${emp.employeeCode})`,
                })),
              ]}
            />
          </FormField>

          <FormField label="Priority" htmlFor="task-priority">
            <Select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              disabled={submitting}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Project" htmlFor="task-project" helperText="Optional group">
            <Select
              id="task-project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={submitting}
              options={[
                { value: '', label: 'No Project (Standalone)' },
                ...projects.map((p) => ({
                  value: p.id,
                  label: `${p.name} (${p.code})`,
                })),
              ]}
            />
          </FormField>

          <FormField label="Due Date" htmlFor="task-due-date" error={errors.dueDate}>
            <Input
              id="task-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={submitting}
            />
          </FormField>
        </div>

        <label
          htmlFor="task-is-daily"
          className="flex items-start gap-3 p-3 rounded-card border border-border bg-surface-muted/50 cursor-pointer hover:border-primary-strong/40 transition-colors"
        >
          <input
            id="task-is-daily"
            type="checkbox"
            checked={isDaily}
            onChange={(e) => setIsDaily(e.target.checked)}
            disabled={submitting}
            data-testid="checkbox-task-daily"
            className="mt-0.5 rounded border-border text-primary-deep focus:ring-primary"
          />
          <div className="space-y-0.5">
            <span className="text-sm font-medium text-text block">Daily Recurring Task</span>
            <span className="text-xs text-text-muted block">
              Repeats every day (e.g. social media posts, daily updates) and stays in your Today /
              Daily Updates list.
            </span>
          </div>
        </label>
      </form>
    </Modal>
  );
}
