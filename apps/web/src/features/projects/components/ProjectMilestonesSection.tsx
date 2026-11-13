import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type {
  CreateMilestoneInput,
  ProjectMilestone,
  ProjectWorkflowStatus,
  UpdateMilestoneInput,
} from '../types';
import { ProjectWorkflowBadge } from './ProjectStatusBadge';

export interface ProjectMilestonesSectionProps {
  milestones: ProjectMilestone[];
  canManage: boolean;
  isArchived: boolean;
  onAddMilestone: (input: CreateMilestoneInput) => Promise<void>;
  onUpdateMilestone: (milestoneId: string, input: UpdateMilestoneInput) => Promise<void>;
}

export function ProjectMilestonesSection({
  milestones,
  canManage,
  isArchived,
  onAddMilestone,
  onUpdateMilestone,
}: ProjectMilestonesSectionProps) {
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<ProjectWorkflowStatus>('not_started');
  const [completionPercent, setCompletionPercent] = useState('0');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'TBD';
    const d = new Date(`${dateStr}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!title.trim()) {
      setFormError('Milestone name is required.');
      return;
    }
    if (startDate && dueDate && dueDate < startDate) {
      setFormError('Due date must be on or after start date.');
      return;
    }
    const pct = Math.max(0, Math.min(100, Math.round(Number(completionPercent) || 0)));

    setSubmitting(true);
    try {
      await onAddMilestone({
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        status,
        completionPercent: pct,
      });
      setTitle('');
      setDescription('');
      setStartDate('');
      setDueDate('');
      setStatus('not_started');
      setCompletionPercent('0');
      setShowForm(false);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to create milestone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickComplete = async (ms: ProjectMilestone) => {
    setUpdatingId(ms.id);
    try {
      await onUpdateMilestone(ms.id, {
        status: ms.status === 'completed' ? 'in_progress' : 'completed',
        completionPercent: ms.status === 'completed' ? 50 : 100,
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div
      className="flex flex-col gap-5 p-6 border rounded-[24px]"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.74)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
      }}
      data-testid="project-milestones-section"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
            Project Milestones ({milestones.length})
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Key delivery phases, due dates, and milestone completion progress.
          </p>
        </div>

        {canManage && !isArchived && (
          <Button
            variant={showForm ? 'outline' : 'primary'}
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            data-testid="toggle-add-milestone-btn"
          >
            {showForm ? 'Close Form' : 'Add Milestone'}
          </Button>
        )}
      </div>

      {showForm && canManage && !isArchived && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 p-4 rounded-2xl border border-border"
          style={{ backgroundColor: 'rgb(244, 247, 246)' }}
        >
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Milestone Name" htmlFor="ms-title" required>
              <Input
                id="ms-title"
                placeholder="e.g. Integration Testing Sign-Off"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={submitting}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Status" htmlFor="ms-status">
                <Select
                  id="ms-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ProjectWorkflowStatus)}
                  disabled={submitting}
                  options={[
                    { value: 'not_started', label: 'Not Started' },
                    { value: 'in_progress', label: 'In Progress' },
                    { value: 'on_hold', label: 'On Hold' },
                    { value: 'completed', label: 'Completed' },
                  ]}
                />
              </FormField>

              <FormField label="Completion (%)" htmlFor="ms-completion">
                <Input
                  id="ms-completion"
                  type="number"
                  min={0}
                  max={100}
                  value={completionPercent}
                  onChange={(e) => setCompletionPercent(e.target.value)}
                  disabled={submitting}
                />
              </FormField>
            </div>
          </div>

          <FormField label="Description" htmlFor="ms-description">
            <Input
              id="ms-description"
              placeholder="Milestone deliverables and acceptance criteria"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Start Date" htmlFor="ms-start-date">
              <Input
                id="ms-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </FormField>
            <FormField label="Due Date" htmlFor="ms-due-date">
              <Input
                id="ms-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={submitting}
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" disabled={submitting}>
              {submitting ? 'Adding...' : 'Save Milestone'}
            </Button>
          </div>
        </form>
      )}

      {milestones.length === 0 ? (
        <div
          className="p-6 text-center rounded-2xl border border-dashed border-border"
          style={{ backgroundColor: 'rgb(244, 247, 246)' }}
        >
          <p className="text-sm font-medium text-text">No milestones defined yet</p>
          <p className="text-xs text-text-muted mt-1">
            Project milestones will appear here once scheduled by the project manager.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {milestones.map((ms, index) => (
            <div
              key={ms.id}
              className="p-4 rounded-2xl border border-border flex flex-col gap-3 transition-colors"
              style={{ backgroundColor: 'rgb(244, 247, 246)' }}
              data-testid={`milestone-item-${ms.id}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex items-start gap-3">
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                    style={{
                      backgroundColor: 'rgba(85, 205, 179, 0.22)',
                      color: 'rgb(8, 11, 12)',
                    }}
                  >
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                      {ms.title}
                    </h3>
                    {ms.description && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                        {ms.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <ProjectWorkflowBadge workflowStatus={ms.status} />
                  {canManage && !isArchived && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={updatingId === ms.id}
                      onClick={() => void handleQuickComplete(ms)}
                    >
                      {ms.status === 'completed' ? 'Reopen' : 'Mark Complete'}
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                  <span>Start: {formatDate(ms.startDate)}</span>
                  <span>Due: {formatDate(ms.dueDate)}</span>
                </div>

                <div className="flex items-center gap-2.5 sm:w-64">
                  <div
                    className="flex-1 h-2 rounded-full overflow-hidden"
                    style={{ backgroundColor: 'rgba(8, 11, 12, 0.08)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${ms.completionPercent}%`,
                        backgroundColor:
                          ms.status === 'completed' ? 'rgb(22, 163, 74)' : 'rgb(85, 205, 179)',
                      }}
                    />
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-text w-10 text-right">
                    {ms.completionPercent}%
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
