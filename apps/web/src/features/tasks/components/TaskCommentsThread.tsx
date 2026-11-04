import React, { useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { createTaskComment, fetchTaskComments } from '../api/tasksApi';
import type { TaskComment } from '../types';

export interface TaskCommentsThreadProps {
  taskId: string;
  currentEmployeeId?: string;
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0];
  const last = parts[parts.length - 1];
  if (parts.length >= 2 && first && last && first[0] && last[0]) {
    return (first[0] + last[0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'U';
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function TaskCommentsThread({
  taskId,
  currentEmployeeId,
  className = '',
}: TaskCommentsThreadProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadComments = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchTaskComments(taskId, { pageSize: 100 }, signal);
      setComments(res.data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not load comments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadComments(controller.signal);
    return () => controller.abort();
  }, [taskId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = newComment.trim();
    if (!text) {
      setSubmitError('Comment cannot be empty.');
      return;
    }
    if (text.length > 2000) {
      setSubmitError('Comment cannot exceed 2000 characters.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createTaskComment(taskId, text);
      setComments((prev) => [...prev, created]);
      setNewComment('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`flex flex-col gap-4 ${className}`} data-testid="task-comments-thread">
      {/* Comments List */}
      <div className="flex flex-col gap-3 max-h-96 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col gap-3 py-4" data-testid="comments-loading">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 bg-surface-muted border border-border rounded-lg animate-pulse p-3"
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-lg flex items-center justify-between"
            role="alert"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadComments()}>
              Retry
            </Button>
          </div>
        ) : comments.length === 0 ? (
          <div
            className="p-6 text-center border border-dashed border-border rounded-lg bg-surface-muted/30"
            data-testid="no-comments-message"
          >
            <p className="text-sm font-medium text-text">No comments yet</p>
            <p className="text-xs text-text-subtle mt-0.5">
              Start the discussion or leave an update on this task.
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isMe = Boolean(
              currentEmployeeId && comment.authorEmployeeId === currentEmployeeId,
            );
            return (
              <div
                key={comment.id}
                className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border shadow-card"
                data-testid={`comment-item-${comment.id}`}
              >
                <div
                  className="w-8 h-8 rounded-full bg-primary-soft text-primary-ink flex items-center justify-center text-xs font-semibold shrink-0 select-none border border-primary-soft-border"
                  aria-hidden="true"
                >
                  {getInitials(comment.authorName)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-text">
                      {comment.authorName}
                      {isMe && <span className="text-text-subtle font-normal ml-1">(You)</span>}
                    </span>
                    <span className="text-[11px] text-text-subtle">
                      {formatDateTime(comment.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-text mt-1.5 whitespace-pre-line leading-relaxed break-words">
                    {comment.body}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Comment Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 pt-2 border-t border-border">
        {submitError && (
          <div
            className="p-2.5 bg-negative-soft border border-border text-danger text-xs rounded-lg"
            role="alert"
            data-testid="comment-submit-error"
          >
            {submitError}
          </div>
        )}

        <div className="relative">
          <textarea
            rows={3}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={submitting}
            placeholder="Write a comment..."
            maxLength={2000}
            className="w-full px-3 py-2 text-sm text-text bg-surface border border-border-strong rounded-lg focus:outline-none focus:border-primary-strong focus:ring-1 focus:ring-primary-strong disabled:bg-surface-muted disabled:text-text-muted transition-colors resize-none min-h-[44px]"
            aria-label="Add a comment"
            data-testid="new-comment-textarea"
          />
          <span className="absolute bottom-2 right-2 text-[10px] text-text-subtle select-none">
            {newComment.length}/2000
          </span>
        </div>

        <div className="flex items-center justify-end">
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={submitting || !newComment.trim()}
            className="min-h-[44px] px-4"
            data-testid="post-comment-btn"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
