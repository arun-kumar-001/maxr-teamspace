import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import type { CreateProjectUpdateInput, ProjectUpdate, ProjectUpdateType } from '../types';

export interface ProjectUpdatesSectionProps {
  updates: ProjectUpdate[];
  currentProgressPercent: number;
  canManage: boolean;
  isArchived: boolean;
  onPostUpdate: (input: CreateProjectUpdateInput) => Promise<void>;
}

const TYPE_META: Record<
  ProjectUpdateType,
  { label: string; bg: string; text: string; border: string }
> = {
  manager_update: {
    label: 'Manager Update',
    bg: 'rgba(73, 53, 72, 0.12)',
    text: 'rgb(73, 53, 72)',
    border: 'rgba(73, 53, 72, 0.25)',
  },
  progress_update: {
    label: 'Progress Update',
    bg: 'rgba(85, 205, 179, 0.18)',
    text: 'rgb(15, 118, 110)',
    border: 'rgba(85, 205, 179, 0.45)',
  },
  comment: {
    label: 'Comment',
    bg: 'rgba(37, 99, 235, 0.1)',
    text: 'rgb(29, 78, 216)',
    border: 'rgba(37, 99, 235, 0.25)',
  },
  activity: {
    label: 'Activity History',
    bg: 'rgba(8, 11, 12, 0.06)',
    text: 'rgb(79, 92, 90)',
    border: 'rgba(8, 11, 12, 0.12)',
  },
};

export function ProjectUpdatesSection({
  updates,
  currentProgressPercent,
  canManage,
  isArchived,
  onPostUpdate,
}: ProjectUpdatesSectionProps) {
  const [filterType, setFilterType] = useState<'all' | ProjectUpdateType>('all');
  const [updateType, setUpdateType] = useState<'manager_update' | 'progress_update' | 'comment'>(
    'progress_update',
  );
  const [content, setContent] = useState('');
  const [progressValue, setProgressValue] = useState(String(currentProgressPercent));
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const managerUpdates = updates.filter((u) => u.updateType === 'manager_update');
  const filteredUpdates =
    filterType === 'all' ? updates : updates.filter((u) => u.updateType === filterType);

  const formatTimestamp = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!content.trim()) {
      setFormError('Please enter update details or a comment.');
      return;
    }

    const parsedProgress = Number(progressValue);
    if (
      updateType !== 'comment' &&
      (Number.isNaN(parsedProgress) || parsedProgress < 0 || parsedProgress > 100)
    ) {
      setFormError('Progress percentage must be between 0 and 100.');
      return;
    }

    setSubmitting(true);
    try {
      await onPostUpdate({
        updateType,
        content: content.trim(),
        ...(updateType !== 'comment' ? { progressPercent: Math.round(parsedProgress) } : {}),
      });
      setContent('');
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Failed to post update');
    } finally {
      setSubmitting(false);
    }
  };

  const composerOptions = [
    { value: 'progress_update', label: 'Progress Update' },
    { value: 'comment', label: 'Project Comment' },
    ...(canManage ? [{ value: 'manager_update', label: 'Manager Update' }] : []),
  ];

  return (
    <div className="flex flex-col gap-5" data-testid="project-updates-section">
      {/* Manager Updates Spotlight */}
      <div
        className="p-5 border rounded-[24px] flex flex-col gap-3"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.74)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: 'rgba(73, 53, 72, 0.18)',
          boxShadow: '0 8px 24px rgba(73, 53, 72, 0.06)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold" style={{ color: 'rgb(73, 53, 72)' }}>
            Manager Updates ({managerUpdates.length})
          </h2>
          <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={{
              backgroundColor: 'rgba(73, 53, 72, 0.1)',
              color: 'rgb(73, 53, 72)',
            }}
          >
            Official Direction
          </span>
        </div>

        {managerUpdates.length === 0 ? (
          <p className="text-xs text-text-muted italic">
            No manager announcements have been posted for this project yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {managerUpdates.slice(0, 3).map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border"
                style={{
                  backgroundColor: 'rgb(244, 247, 246)',
                  borderColor: 'rgba(73, 53, 72, 0.15)',
                }}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
                    {item.authorName}
                  </span>
                  <span className="text-[11px] text-text-subtle">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-text leading-relaxed whitespace-pre-line">
                  {item.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Progress Update / Comment Composer */}
      {!isArchived && (
        <form
          onSubmit={handleSubmit}
          className="p-6 border rounded-[24px] flex flex-col gap-4"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.74)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
          }}
        >
          <div>
            <h3 className="font-display text-base font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
              Add Progress Update or Comment
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Share task progress, blockers, or team discussion with project collaborators.
            </p>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Update Type" htmlFor="project-update-type">
              <Select
                id="project-update-type"
                value={updateType}
                onChange={(e) =>
                  setUpdateType(e.target.value as 'manager_update' | 'progress_update' | 'comment')
                }
                disabled={submitting}
                options={composerOptions}
              />
            </FormField>

            {updateType !== 'comment' && (
              <FormField label="Updated Project Progress (%)" htmlFor="project-update-progress">
                <Input
                  id="project-update-progress"
                  type="number"
                  min={0}
                  max={100}
                  value={progressValue}
                  onChange={(e) => setProgressValue(e.target.value)}
                  disabled={submitting}
                />
              </FormField>
            )}
          </div>

          <FormField
            label={updateType === 'comment' ? 'Comment' : 'Progress Details'}
            htmlFor="project-update-content"
            required
          >
            <textarea
              id="project-update-content"
              rows={3}
              className="w-full px-3 py-2 text-sm text-text bg-surface-raised border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-primary-strong disabled:opacity-50"
              placeholder={
                updateType === 'comment'
                  ? 'Write a comment for the team...'
                  : 'Summarize what you completed or updated...'
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              disabled={submitting}
            />
          </FormField>

          <div className="flex justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={submitting}
              data-testid="submit-project-update-btn"
            >
              {submitting
                ? 'Posting...'
                : updateType === 'comment'
                  ? 'Submit Comment'
                  : 'Post Update'}
            </Button>
          </div>
        </form>
      )}

      {/* Chronological Project Activity & Updates Feed */}
      <div
        className="p-6 border rounded-[24px] flex flex-col gap-4"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.74)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
            Project Activity History ({filteredUpdates.length})
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                ['all', 'All'],
                ['manager_update', 'Manager'],
                ['progress_update', 'Progress'],
                ['comment', 'Comments'],
                ['activity', 'History'],
              ] as const
            ).map(([key, label]) => {
              const active = filterType === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilterType(key)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border"
                  style={
                    active
                      ? {
                          backgroundColor: 'rgb(85, 205, 179)',
                          color: 'rgb(8, 11, 12)',
                          borderColor: 'rgb(85, 205, 179)',
                        }
                      : {
                          backgroundColor: 'rgb(244, 247, 246)',
                          color: 'rgb(79, 92, 90)',
                          borderColor: 'rgba(8, 11, 12, 0.1)',
                        }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {filteredUpdates.length === 0 ? (
          <p className="text-sm text-text-muted italic py-4 text-center">
            No entries match this filter yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredUpdates.map((item) => {
              const meta = TYPE_META[item.updateType] ?? TYPE_META.activity;
              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-border flex flex-col gap-2"
                  style={{ backgroundColor: 'rgb(244, 247, 246)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold" style={{ color: 'rgb(8, 11, 12)' }}>
                        {item.authorName}
                      </span>
                      {item.authorRoleLabel && (
                        <span className="text-xs text-text-subtle">
                          &middot; {item.authorRoleLabel}
                        </span>
                      )}
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                        style={{
                          backgroundColor: meta.bg,
                          color: meta.text,
                          borderColor: meta.border,
                        }}
                      >
                        {meta.label}
                      </span>
                      {item.progressPercent !== null && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                          style={{
                            backgroundColor: 'rgba(85, 205, 179, 0.16)',
                            color: 'rgb(15, 118, 110)',
                          }}
                        >
                          {item.progressPercent}% Progress
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-text-subtle">
                      {formatTimestamp(item.createdAt)}
                    </span>
                  </div>

                  <p className="text-sm text-text leading-relaxed whitespace-pre-line">
                    {item.content}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
