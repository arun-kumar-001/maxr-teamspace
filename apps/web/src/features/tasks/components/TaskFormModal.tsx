import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { Select } from '../../../components/ui/Select';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import { fetchProfile } from '../../profile/api/profileApi';
import type { EmployeeProfile } from '../../profile/types';
import { fetchProjects } from '../../projects/api/projectsApi';
import type { Project } from '../../projects/types';
import { notifyTaskCreated } from '../task-sync';
import type { CreateTaskInput, Task, TaskPriority, UpdateTaskInput } from '../types';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialTask?: Task | null;
  defaultAssigneeId?: string;
  defaultProjectId?: string;
  isStaff?: boolean;
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
  isStaff,
  onSubmitCreate,
  onSubmitEdit,
}: TaskFormModalProps) {
  const { user, role } = useAuth();
  const isStaffUser =
    isStaff ??
    (role === 'staff' && !user?.roles?.includes('admin') && !user?.roles?.includes('team_lead'));

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [assignToMe, setAssignToMe] = useState(false);
  const [isDaily, setIsDaily] = useState(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [userProfile, setUserProfile] = useState<EmployeeProfile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // Match current user in employee directory or fetched profile
  const currentUserEmployee = useMemo(() => {
    if (!user && !userProfile) return null;
    return (
      employees.find((e) => {
        if (
          userProfile &&
          (e.id === userProfile.id ||
            (userProfile.employeeCode &&
              e.employeeCode.toLowerCase() === userProfile.employeeCode.toLowerCase()))
        ) {
          return true;
        }
        if (user?.employeeId && e.id === user.employeeId) return true;
        if (user?.email && e.email.toLowerCase() === user.email.toLowerCase()) return true;
        return false;
      }) || null
    );
  }, [employees, user, userProfile]);

  const effectiveEmployeeId = useMemo(() => {
    return userProfile?.id || currentUserEmployee?.id || user?.employeeId || '';
  }, [userProfile, currentUserEmployee, user]);

  const effectiveEmployeeName = useMemo(() => {
    if (userProfile) {
      const name = `${userProfile.firstName} ${userProfile.lastName}`.trim();
      if (name) return name;
    }
    if (currentUserEmployee) {
      const name = `${currentUserEmployee.firstName} ${currentUserEmployee.lastName}`.trim();
      if (name) return name;
    }
    return user?.name || 'Current User';
  }, [userProfile, currentUserEmployee, user]);

  const effectiveEmployeeCode = useMemo(() => {
    return userProfile?.employeeCode || currentUserEmployee?.employeeCode || '';
  }, [userProfile, currentUserEmployee]);

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
      // In edit mode, check if already assigned to current user
      const isAssignedToCurrent = Boolean(
        effectiveEmployeeId && initialTask.assigneeEmployeeId === effectiveEmployeeId,
      );
      setAssignToMe(isAssignedToCurrent);
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setProjectId(defaultProjectId ?? '');
      setAssignToMe(false);

      if (isStaffUser) {
        // For staff, auto-assign to the currently authenticated staff member
        setAssigneeId(effectiveEmployeeId);
      } else if (
        defaultAssigneeId &&
        defaultAssigneeId !== effectiveEmployeeId &&
        defaultAssigneeId !== user?.employeeId
      ) {
        // If defaultAssigneeId is provided and NOT the current user, prefill it; otherwise leave empty
        setAssigneeId(defaultAssigneeId);
      } else {
        setAssigneeId('');
      }
      setIsDaily(false);
    }

    // Load available projects and employees for dropdowns
    void fetchProjects({ status: 'active', pageSize: 100 })
      .then((res) => setProjects(res.data))
      .catch(() => setProjects([]));

    if (!isStaffUser) {
      void fetchEmployeeDirectory({ status: 'active', pageSize: 100 })
        .then((res) => setEmployees(res.data))
        .catch(() => setEmployees([]));
    }

    // Fetch current user's actual profile to guarantee exact employeeId, code and name
    void fetchProfile()
      .then((res) => setUserProfile(res))
      .catch(() => setUserProfile(null));
  }, [
    isOpen,
    mode,
    initialTask,
    defaultProjectId,
    defaultAssigneeId,
    effectiveEmployeeId,
    user?.employeeId,
    isStaffUser,
  ]);

  // Keep assigneeId in sync if staff or Assign to Me is checked and effective employee ID finishes loading
  useEffect(() => {
    if (isStaffUser) {
      if (effectiveEmployeeId && assigneeId !== effectiveEmployeeId) {
        setAssigneeId(effectiveEmployeeId);
      }
      setErrors((prev) => {
        if (!prev.assigneeId) return prev;
        const next = { ...prev };
        delete next.assigneeId;
        return next;
      });
    } else if (assignToMe && effectiveEmployeeId && assigneeId !== effectiveEmployeeId) {
      setAssigneeId(effectiveEmployeeId);
      setErrors((prev) => {
        if (!prev.assigneeId) return prev;
        const next = { ...prev };
        delete next.assigneeId;
        return next;
      });
    }
  }, [isStaffUser, assignToMe, effectiveEmployeeId, assigneeId]);

  const handleAssignToMeChange = (checked: boolean) => {
    setAssignToMe(checked);
    if (checked) {
      setAssigneeId(effectiveEmployeeId);
      setErrors((prev) => {
        if (!prev.assigneeId) return prev;
        const next = { ...prev };
        delete next.assigneeId;
        return next;
      });
    } else {
      // If unchecked, clear the auto-selected assignee
      setAssigneeId('');
    }
  };

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

    // For non-staff, manual selection of an assignee is mandatory
    if (!isStaffUser && !assigneeId) {
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

    const targetAssigneeId = isStaffUser
      ? effectiveEmployeeId || user?.employeeId || assigneeId
      : assigneeId;

    try {
      if (mode === 'create') {
        if (!onSubmitCreate) return;
        const input: CreateTaskInput = {
          title: title.trim(),
          description: description.trim() || undefined,
          assigneeEmployeeId: targetAssigneeId,
          priority,
          dueDate: dueDate || undefined,
          projectId: projectId || undefined,
          isDaily,
        };
        const created = await onSubmitCreate(input);
        if (created && typeof created === 'object' && 'id' in created) {
          notifyTaskCreated(created as Task);
        }
      } else {
        if (!onSubmitEdit) return;
        const input: Omit<UpdateTaskInput, 'version'> = {
          title: title.trim(),
          description: description.trim() || null,
          assigneeEmployeeId: targetAssigneeId,
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

  const assigneeOptions = useMemo(() => {
    const list: Array<{ value: string; label: string }> = [
      { value: '', label: 'Select Team Member' },
    ];

    // If an assigneeId is selected that isn't yet in employees array
    if (assigneeId && !employees.some((e) => e.id === assigneeId)) {
      const isSelf = assigneeId === effectiveEmployeeId || assigneeId === user?.employeeId;
      const label = isSelf
        ? effectiveEmployeeCode
          ? `${effectiveEmployeeName} (${effectiveEmployeeCode})`
          : effectiveEmployeeName
        : 'Selected Assignee';
      list.push({ value: assigneeId, label });
    }

    for (const emp of employees) {
      const fullName = `${emp.firstName} ${emp.lastName}`.trim();
      list.push({
        value: emp.id,
        label: `${fullName} (${emp.employeeCode})`,
      });
    }

    return list;
  }, [
    employees,
    assigneeId,
    effectiveEmployeeId,
    effectiveEmployeeName,
    effectiveEmployeeCode,
    user?.employeeId,
  ]);

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
            data-testid="task-title-input"
            placeholder="e.g. Implement user export CSV"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={submitting}
            autoFocus
          />
        </FormField>

        {isStaffUser ? (
          <FormField
            label="Description"
            htmlFor="task-description"
            error={errors.description}
            helperText="Optional details or criteria for this task"
          >
            <textarea
              id="task-description"
              data-testid="task-description-input"
              rows={3}
              className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:bg-surface-muted"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </FormField>
        ) : (
          <FormField label="Description" htmlFor="task-description" error={errors.description}>
            <textarea
              id="task-description"
              data-testid="task-description-input"
              rows={3}
              className="w-full px-3 py-2 text-sm text-text bg-surface border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:bg-surface-muted"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
            <div className="flex flex-wrap items-center justify-between gap-2 mt-1.5">
              <span className="text-xs text-text-muted">
                Optional details or criteria for this task
              </span>
              <label
                htmlFor="task-assign-to-me"
                className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-medium text-text hover:text-primary-deep transition-colors"
              >
                <input
                  id="task-assign-to-me"
                  type="checkbox"
                  checked={assignToMe}
                  onChange={(e) => handleAssignToMeChange(e.target.checked)}
                  disabled={submitting}
                  data-testid="checkbox-assign-to-me"
                  className="rounded border-border text-primary-deep focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span>Assign to Me</span>
              </label>
            </div>
          </FormField>
        )}

        {isStaffUser ? (
          /* Staff Portal: No Assignee field or checkbox; Priority, Project and Due Date reorganized to fill space */
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Priority" htmlFor="task-priority">
              <Select
                id="task-priority"
                data-testid="task-priority-select"
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

            <FormField label="Project" htmlFor="task-project" helperText="Optional group">
              <Select
                id="task-project"
                data-testid="task-project-select"
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
                data-testid="task-due-date-input"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={submitting}
              />
            </FormField>
          </div>
        ) : (
          /* Admin / Lead Portal: Retain full Assignee dropdown and 2x2 grid */
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Assignee"
                htmlFor="task-assignee"
                required
                error={errors.assigneeId}
              >
                <Select
                  id="task-assignee"
                  data-testid="task-assignee-select"
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                  disabled={submitting || assignToMe}
                  options={assigneeOptions}
                />
              </FormField>

              <FormField label="Priority" htmlFor="task-priority">
                <Select
                  id="task-priority"
                  data-testid="task-priority-select"
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
                  data-testid="task-project-select"
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
                  data-testid="task-due-date-input"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={submitting}
                />
              </FormField>
            </div>
          </>
        )}

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
              Repeats every day and stays in your Today / Daily Updates list.
            </span>
          </div>
        </label>
      </form>
    </Modal>
  );
}
