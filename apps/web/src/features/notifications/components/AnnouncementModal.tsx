import { useState } from 'react';
import { Button, FormField, Input, Modal } from '../../../components/ui';
import type { AnnouncementInput, AnnouncementResult } from '../types';

export interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (payload: AnnouncementInput) => Promise<AnnouncementResult>;
}

export function AnnouncementModal({ isOpen, onClose, onSend }: AnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setError('Please provide both an announcement title and message.');
      return;
    }

    if (title.length > 100) {
      setError('Title cannot exceed 100 characters.');
      return;
    }

    if (message.length > 1000) {
      setError('Message cannot exceed 1000 characters.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      const result = await onSend({
        title: title.trim(),
        message: message.trim(),
      });
      setSuccessInfo(
        `Announcement broadcasted to ${result.recipients} employee${result.recipients === 1 ? '' : 's'}.`,
      );
      setTitle('');
      setMessage('');
      setTimeout(() => {
        setSuccessInfo(null);
        onClose();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to broadcast announcement');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    setError(null);
    setSuccessInfo(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Broadcast Company Announcement">
      <p className="text-xs text-text-muted -mt-2 mb-4">
        Send an in-app announcement notification to all active employees.
      </p>

      {successInfo ? (
        <div
          className="rounded-input border border-positive-ink/20 bg-positive-soft p-4 text-center"
          data-testid="announcement-success-message"
        >
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-positive-ink/10 text-positive-ink mb-2">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-positive-ink">{successInfo}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4" data-testid="announcement-form">
          {error && (
            <div
              className="rounded-input border border-negative-ink/20 bg-negative-soft p-3 text-xs text-negative-ink"
              role="alert"
              data-testid="announcement-error-message"
            >
              {error}
            </div>
          )}

          <div className="space-y-1">
            <FormField label="Announcement Title" required htmlFor="announcement-title">
              <Input
                id="announcement-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Office town hall meeting this Friday"
                maxLength={100}
                required
                data-testid="announcement-title-input"
              />
            </FormField>
            <div className="flex justify-end">
              <span className="text-[11px] text-text-muted">{title.length}/100 characters</span>
            </div>
          </div>

          <div className="space-y-1">
            <FormField label="Message Body" required htmlFor="announcement-message">
              <textarea
                id="announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement message here..."
                rows={4}
                maxLength={1000}
                required
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-text-muted/60 focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong min-h-[100px]"
                data-testid="announcement-message-input"
              />
            </FormField>
            <div className="flex justify-end">
              <span className="text-[11px] text-text-muted">{message.length}/1000 characters</span>
            </div>
          </div>

          <div className="rounded-input bg-surface-muted/60 border border-border p-3 text-xs text-text-muted">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-primary-deep shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                Announcements are delivered in-app to every active employee's inbox (not e-mailed).
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !title.trim() || !message.trim()}
              data-testid="submit-announcement-btn"
            >
              {isSubmitting ? 'Broadcasting...' : 'Broadcast Announcement'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
