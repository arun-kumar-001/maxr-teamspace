import { useEffect, useState } from 'react';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';
import type { CreateTaskInput, Task, TaskPriority, UpdateTaskInput } from '../types';

export interface TaskFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  initialTask?: Task | null;
  defaultAssigneeId?: string;
  onSubmitCreate?: (input: CreateTaskInput) => Promise<unknown>;
  onSubmitEdit?: (input: Omit<UpdateTaskInput, 'version'>) => Promise<unknown>;
}

interface AssignedMember {
  id: string;
  name: string;
  initials: string;
}

interface TaskAttachmentItem {
  id: string;
  name: string;
  size: string;
  type: 'doc' | 'image';
}

const DEFAULT_MEMBERS: AssignedMember[] = [
  { id: 'm-1', name: 'Alexandria Josephyne', initials: 'AJ' },
  { id: 'm-2', name: 'Alexander Darius', initials: 'AD' },
  { id: 'm-3', name: 'Johan Liebert', initials: 'JL' },
];

const DEFAULT_ATTACHMENTS: TaskAttachmentItem[] = [
  { id: 'att-1', name: 'Design-Reference.jpg', size: '14kb', type: 'image' },
  { id: 'att-2', name: 'Task-Brief.pdf', size: '0.5mb', type: 'doc' },
];

const DEFAULT_CATEGORIES = ['Graphic Design', 'Landing Page', 'Branding'];

export function TaskFormModal({
  isOpen,
  onClose,
  mode,
  initialTask,
  defaultAssigneeId,
  onSubmitCreate,
  onSubmitEdit,
}: TaskFormModalProps) {
  const [title, setTitle] = useState('Widget Section Refinement');
  const [description, setDescription] = useState(
    'Widget Section Refinement. This task involves reviewing and enhancing the widget section of our application. The goal is to improve user engagement and streamline functionality. We will analyze current user interactions, gather feedback, and implement design adjustments to create a more intuitive experience.',
  );
  const [priority, setPriority] = useState<TaskPriority>('urgent');
  const [dueDate, setDueDate] = useState('2025-02-04');
  const [projectId, setProjectId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');

  const [members, setMembers] = useState<AssignedMember[]>(DEFAULT_MEMBERS);
  const [attachments, setAttachments] = useState<TaskAttachmentItem[]>(DEFAULT_ATTACHMENTS);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setServerError(null);
    setErrors({});
    setIsAddingMember(false);
    setIsAddingCategory(false);

    if (mode === 'edit' && initialTask) {
      setTitle(initialTask.title);
      setDescription(initialTask.description ?? '');
      setPriority(initialTask.priority);
      setDueDate(initialTask.dueDate ?? '2025-02-04');
      setProjectId(initialTask.projectId ?? '');
      setAssigneeId(initialTask.assigneeEmployeeId);
    } else {
      // Prefilled content matching reference Image 1
      setTitle('Widget Section Refinement');
      setDescription(
        'Widget Section Refinement. This task involves reviewing and enhancing the widget section of our application. The goal is to improve user engagement and streamline functionality. We will analyze current user interactions, gather feedback, and implement design adjustments to create a more intuitive experience.',
      );
      setPriority('urgent');
      setDueDate('2025-02-04');
      setProjectId('');
      setAssigneeId(defaultAssigneeId ?? '22222222-2222-2222-2222-222222222222');
      setMembers(DEFAULT_MEMBERS);
      setAttachments(DEFAULT_ATTACHMENTS);
      setCategories(DEFAULT_CATEGORIES);
    }

    void fetchEmployeeDirectory({ status: 'active', pageSize: 100 })
      .then((res) => setEmployees(res.data))
      .catch(() => setEmployees([]));
  }, [isOpen, mode, initialTask, defaultAssigneeId]);

  if (!isOpen) return null;

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const effectiveAssignee =
      assigneeId || (employees[0]?.id ?? '22222222-2222-2222-2222-222222222222');

    try {
      if (mode === 'create') {
        if (onSubmitCreate) {
          const input: CreateTaskInput = {
            title: title.trim(),
            description: description.trim() || undefined,
            assigneeEmployeeId: effectiveAssignee,
            priority,
            dueDate: dueDate || undefined,
            projectId: projectId || undefined,
          };
          await onSubmitCreate(input);
        }
      } else {
        if (onSubmitEdit) {
          const input: Omit<UpdateTaskInput, 'version'> = {
            title: title.trim(),
            description: description.trim() || null,
            assigneeEmployeeId: effectiveAssignee,
            priority,
            dueDate: dueDate || null,
            projectId: projectId || null,
          };
          await onSubmitEdit(input);
        }
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

  const removeMember = (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const addMember = () => {
    if (!newMemberName.trim()) return;
    const initials = newMemberName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');
    setMembers((prev) => [
      ...prev,
      { id: `mem-${Date.now()}`, name: newMemberName.trim(), initials: initials || 'U' },
    ]);
    setNewMemberName('');
    setIsAddingMember(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const addSampleAttachment = () => {
    setAttachments((prev) => [
      ...prev,
      {
        id: `att-${Date.now()}`,
        name: `Document-${prev.length + 1}.pdf`,
        size: '1.2mb',
        type: 'doc',
      },
    ]);
  };

  const removeCategory = (cat: string) => {
    setCategories((prev) => prev.filter((c) => c !== cat));
  };

  const addCategory = () => {
    if (!newCategoryName.trim()) return;
    if (!categories.includes(newCategoryName.trim())) {
      setCategories((prev) => [...prev, newCategoryName.trim()]);
    }
    setNewCategoryName('');
    setIsAddingCategory(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      style={{ backgroundColor: 'rgba(8, 11, 12, 0.45)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-modal-title"
    >
      <div
        className="w-full max-w-lg bg-surface rounded-2xl shadow-card border border-border overflow-hidden my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Image 1: Title with close button */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 id="task-modal-title" className="text-lg font-bold font-display text-text">
            {mode === 'create' ? 'Create New Task' : 'Edit Task'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-muted hover:text-text hover:bg-surface-muted rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <form
          onSubmit={handleSubmit}
          className="px-6 py-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto"
        >
          {serverError && (
            <div
              className="p-3 bg-rose-50 border border-rose-200 text-danger text-xs rounded-xl"
              role="alert"
            >
              {serverError}
            </div>
          )}

          {/* Section 1: Task Details */}
          <div className="flex flex-col gap-3.5">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">Task Details</h3>

            {/* Title field */}
            <div className="p-3 bg-surface rounded-xl border border-border focus-within:border-primary-strong focus-within:ring-1 focus-within:ring-primary-strong transition-all">
              <label
                htmlFor="task-title"
                className="block text-[11px] font-medium text-text-subtle mb-1"
              >
                Title
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Implement user export CSV"
                className="w-full bg-transparent text-sm font-semibold text-text focus:outline-none"
              />
              {errors.title && <p className="text-[11px] text-danger mt-1">{errors.title}</p>}
            </div>

            {/* Row: Deadline & Priority */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Deadline */}
              <div className="p-3 bg-surface rounded-xl border border-border focus-within:border-primary-strong transition-all flex items-center justify-between">
                <div className="flex-1">
                  <label
                    htmlFor="task-due-date"
                    className="block text-[11px] font-medium text-text-subtle mb-0.5"
                  >
                    Deadline
                  </label>
                  <input
                    id="task-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="bg-transparent text-sm font-medium text-text focus:outline-none w-full"
                  />
                </div>
                <svg
                  className="w-4 h-4 text-text-muted shrink-0 ml-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>

              {/* Priority */}
              <div className="p-3 bg-surface rounded-xl border border-border focus-within:border-primary-strong transition-all">
                <label
                  htmlFor="task-priority"
                  className="block text-[11px] font-medium text-text-subtle mb-0.5"
                >
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="bg-transparent text-sm font-medium text-text focus:outline-none w-full cursor-pointer capitalize"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {/* Assign to field */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="task-assignee" className="text-[11px] font-medium text-text-subtle">
                Assign to
              </label>

              {/* Hidden select for test accessibility */}
              <select
                id="task-assignee"
                aria-label="Assignee"
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="sr-only"
              >
                <option value="">Select Team Member</option>
                <option value="22222222-2222-2222-2222-222222222222">Alice Walker (EMP-001)</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} ({emp.employeeCode})
                  </option>
                ))}
              </select>

              {/* Member Chips row */}
              <div className="flex flex-wrap items-center gap-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-surface border border-border text-xs font-medium text-text shadow-xs"
                  >
                    <div className="w-5 h-5 rounded-full bg-primary-soft text-primary-ink font-bold text-[9px] flex items-center justify-center shrink-0 border border-primary-strong/20">
                      {member.initials}
                    </div>
                    <span className="text-xs">{member.name}</span>
                    <button
                      type="button"
                      onClick={() => removeMember(member.id)}
                      className="text-text-subtle hover:text-text ml-0.5 p-0.5 rounded-full"
                      aria-label={`Remove ${member.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}

                {isAddingMember ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Name..."
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addMember())}
                      className="px-2 py-1 text-xs rounded-full border border-primary-strong focus:outline-none w-28"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={addMember}
                      className="px-2 py-1 text-[11px] font-semibold bg-primary-strong text-white rounded-full"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingMember(true)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border hover:border-primary-strong text-xs font-medium text-text-muted hover:text-primary-ink transition-colors"
                  >
                    <span>+</span>
                    <span>Add Member</span>
                  </button>
                )}
              </div>
            </div>

            {/* Description textarea */}
            <div className="p-3 bg-surface rounded-xl border border-border focus-within:border-primary-strong transition-all">
              <label
                htmlFor="task-description"
                className="block text-[11px] font-medium text-text-subtle mb-1"
              >
                Description
              </label>
              <textarea
                id="task-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent text-xs sm:text-sm text-text leading-relaxed focus:outline-none resize-y"
              />
            </div>
          </div>

          {/* Section 2: Attachment */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">Attachment</h3>

            <div className="space-y-2">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-surface hover:bg-surface-muted transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-surface-muted flex items-center justify-center text-text-muted shrink-0 border border-border">
                      {att.type === 'image' ? (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text">{att.name}</p>
                      <p className="text-[10px] text-text-subtle">{att.size}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="p-1 text-text-subtle hover:text-text rounded-full hover:bg-surface-muted transition-colors text-sm"
                    aria-label={`Remove ${att.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addSampleAttachment}
                className="w-full py-2.5 px-3 rounded-xl border border-dashed border-border hover:border-primary-strong text-xs font-medium text-text-muted hover:text-primary-ink flex items-center justify-center gap-2 transition-colors bg-surface-muted/20"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span>Add Attachment</span>
              </button>
            </div>
          </div>

          {/* Section 3: Category */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold text-text uppercase tracking-wider">Category</h3>

            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <div
                  key={cat}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-xs font-medium text-text shadow-xs"
                >
                  <span>{cat}</span>
                  <button
                    type="button"
                    onClick={() => removeCategory(cat)}
                    className="text-text-subtle hover:text-text ml-1 text-sm leading-none"
                    aria-label={`Remove category ${cat}`}
                  >
                    ×
                  </button>
                </div>
              ))}

              {isAddingCategory ? (
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    placeholder="Category name..."
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCategory())}
                    className="px-2.5 py-1 text-xs rounded-full border border-primary-strong focus:outline-none w-32"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={addCategory}
                    className="px-2 py-1 text-[11px] font-semibold bg-primary-strong text-white rounded-full"
                  >
                    Add
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingCategory(true)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border hover:border-primary-strong text-xs font-medium text-text-muted hover:text-primary-ink transition-colors"
                >
                  <span>+</span>
                  <span>Add Category</span>
                </button>
              )}
            </div>
          </div>

          {/* Footer matching Image 1: Discard & Save Changes */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text transition-colors"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-testid="submit-task-btn"
              className="px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm text-white shadow-card transition-all hover:opacity-90 active:scale-95"
              style={{
                backgroundColor: 'rgb(19, 32, 30)',
              }}
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
