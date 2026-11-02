import { useState } from 'react';
import { Button, Modal } from '../../../components/ui';
import type { EmployeeDocumentSummary } from '../types/documents';

export interface DeleteDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: EmployeeDocumentSummary | null;
  onConfirmDelete: (docId: string) => Promise<void>;
}

export function DeleteDocumentModal({
  isOpen,
  onClose,
  document,
  onConfirmDelete,
}: DeleteDocumentModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!document) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);
    try {
      await onConfirmDelete(document.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete document.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isDeleting) onClose();
      }}
      title="Delete Document"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button variant="ghost" size="md" disabled={isDeleting} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isDeleting}
            onClick={handleDelete}
            data-testid="confirm-delete-document-btn"
          >
            Delete Document
          </Button>
        </div>
      }
    >
      <div className="p-4 space-y-3" data-testid="delete-document-modal">
        {error && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-input font-medium"
            role="alert"
          >
            {error}
          </div>
        )}

        <p className="text-sm text-text">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-text">{document.title}</span>?
        </p>
        <p className="text-xs text-text-muted">
          This document will be soft-deleted and removed from the active records, but preserved for
          compliance auditing.
        </p>
      </div>
    </Modal>
  );
}
