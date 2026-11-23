import React, { useEffect, useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import {
  deleteTaskAttachment,
  fetchAttachmentDownloadLink,
  fetchTaskAttachments,
  uploadTaskAttachment,
} from '../api/tasksApi';
import type { TaskAttachment } from '../types';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS_PER_TASK,
  MAX_ATTACHMENT_SIZE_BYTES,
} from '../types';

export interface TaskAttachmentsListProps {
  taskId: string;
  currentEmployeeId?: string;
  assignerEmployeeId?: string;
  isAdmin?: boolean;
  className?: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatUploadDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function TaskAttachmentsList({
  taskId,
  currentEmployeeId,
  assignerEmployeeId,
  isAdmin = false,
  className = '',
}: TaskAttachmentsListProps) {
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAttachments = async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchTaskAttachments(taskId, signal);
      setAttachments(data);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Could not load attachments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void loadAttachments(controller.signal);
    return () => controller.abort();
  }, [taskId]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (attachments.length >= MAX_ATTACHMENTS_PER_TASK) {
      setUploadError(`Task can have at most ${MAX_ATTACHMENTS_PER_TASK} attachments.`);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setUploadError('File exceeds maximum allowed size of 10 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const isAllowed = ALLOWED_ATTACHMENT_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_TYPES)[number],
    );
    if (!isAllowed) {
      setUploadError('Only PDF, PNG, or JPEG files are supported.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const created = await uploadTaskAttachment(taskId, file);
      setAttachments((prev) => [created, ...prev]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload attachment.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.id);
    try {
      const link = await fetchAttachmentDownloadLink(taskId, attachment.id);
      window.open(link.url, '_blank', 'noopener,noreferrer');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Could not download attachment.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    setDeletingId(attachmentId);
    try {
      await deleteTaskAttachment(taskId, attachmentId);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete attachment.');
    } finally {
      setDeletingId(null);
    }
  };

  const isFull = attachments.length >= MAX_ATTACHMENTS_PER_TASK;

  return (
    <div className={`flex flex-col gap-4 ${className}`} data-testid="task-attachments-list">
      {/* Upload Zone / Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-surface-muted rounded-card border border-border">
        <div>
          <span className="text-xs font-semibold text-text uppercase tracking-wider block">
            Attachments ({attachments.length}/{MAX_ATTACHMENTS_PER_TASK})
          </span>
          <span className="text-[11px] text-text-subtle mt-0.5 block">
            PDF, PNG, or JPEG up to 10 MB per file.
          </span>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={handleFileSelected}
            disabled={uploading || isFull}
            className="hidden"
            id={`task-attachment-input-${taskId}`}
            data-testid="task-attachment-input"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={uploading || isFull}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[44px]"
            data-testid="upload-attachment-btn"
          >
            {uploading ? (
              'Uploading...'
            ) : isFull ? (
              'Attachment Limit Reached'
            ) : (
              <span className="flex items-center gap-1.5">
                <svg
                  className="w-4 h-4 text-primary-strong"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload File
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Upload Error */}
      {uploadError && (
        <div
          className="p-3 bg-negative-soft border border-border text-danger text-xs rounded-lg"
          role="alert"
          data-testid="attachment-upload-error"
        >
          {uploadError}
        </div>
      )}

      {/* Attachments List */}
      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex flex-col gap-2 py-4" data-testid="attachments-loading">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-16 bg-surface-muted border border-border rounded-lg animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div
            className="p-3 bg-negative-soft border border-border text-danger text-sm rounded-lg flex items-center justify-between"
            role="alert"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => void loadAttachments()}>
              Retry
            </Button>
          </div>
        ) : attachments.length === 0 ? (
          <div
            className="p-6 text-center border border-dashed border-border rounded-lg bg-surface-muted/30"
            data-testid="no-attachments-message"
          >
            <p className="text-sm font-medium text-text">No attachments yet</p>
            <p className="text-xs text-text-subtle mt-0.5">
              Upload documents, screenshots, or receipts relevant to this task.
            </p>
          </div>
        ) : (
          attachments.map((att) => {
            const isUploader = Boolean(
              currentEmployeeId && att.uploadedByEmployeeId === currentEmployeeId,
            );
            const isAssigner = Boolean(
              currentEmployeeId && assignerEmployeeId && currentEmployeeId === assignerEmployeeId,
            );
            const canDelete = Boolean(isAdmin || isUploader || isAssigner);
            const isPdf = att.contentType === 'application/pdf';

            return (
              <div
                key={att.id}
                className="flex items-center justify-between gap-3 p-3 bg-surface rounded-lg border border-border shadow-card hover:border-border-strong transition-colors"
                data-testid={`attachment-item-${att.id}`}
              >
                {/* File info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                      isPdf
                        ? 'bg-negative-soft border-border text-negative-ink'
                        : 'bg-primary-soft border-primary-soft-border text-primary-ink'
                    }`}
                    aria-hidden="true"
                  >
                    {isPdf ? (
                      <span className="font-bold text-[10px] tracking-tight">PDF</span>
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
                          strokeWidth="2"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    )}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium text-text truncate max-w-xs sm:max-w-md">
                      {att.originalName}
                    </span>
                    <div className="flex items-center gap-2 text-[11px] text-text-subtle flex-wrap">
                      <span>{formatFileSize(att.size)}</span>
                      <span>•</span>
                      <span>
                        Uploaded by {att.uploadedByName}
                        {isUploader && ' (You)'}
                      </span>
                      <span>•</span>
                      <span>{formatUploadDate(att.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={downloadingId === att.id}
                    onClick={() => handleDownload(att)}
                    className="min-h-[44px]"
                    data-testid={`download-attachment-${att.id}`}
                    aria-label={`Download ${att.originalName}`}
                  >
                    {downloadingId === att.id ? 'Loading...' : 'Download'}
                  </Button>

                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={deletingId === att.id}
                      onClick={() => handleDelete(att.id)}
                      className="min-h-[44px] text-danger hover:text-danger hover:bg-negative-soft"
                      data-testid={`delete-attachment-${att.id}`}
                      aria-label={`Delete ${att.originalName}`}
                    >
                      {deletingId === att.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
