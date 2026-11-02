import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Button, FormField, Input, Modal, Select } from '../../../components/ui';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
} from '../types/documents';

export interface UploadDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (
    file: File,
    meta: { documentType: DocumentType; title: string; isSensitive?: boolean },
  ) => Promise<unknown>;
  canSetSensitive?: boolean;
}

const DOCUMENT_TYPE_OPTIONS = Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export function UploadDocumentModal({
  isOpen,
  onClose,
  onUpload,
  canSetSensitive = false,
}: UploadDocumentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType>('id_proof');
  const [isSensitive, setIsSensitive] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        setError('File size must not exceed 10 MB.');
        return;
      }
      setFile(selected);
      setError(null);
      if (!title) {
        // Strip extension for initial default title
        const baseName = selected.name.replace(/\.[^/.]+$/, '');
        setTitle(baseName);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!file) {
      setError('Please select a file to upload.');
      return;
    }

    if (!title.trim()) {
      setError('Document title is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onUpload(file, {
        documentType,
        title: title.trim(),
        isSensitive,
      });
      // Reset form on success
      setFile(null);
      setTitle('');
      setDocumentType('id_proof');
      setIsSensitive(false);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload document.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!isSubmitting) onClose();
      }}
      title="Upload Employee Document"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            variant="ghost"
            size="md"
            disabled={isSubmitting}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="md"
            isLoading={isSubmitting}
            disabled={isSubmitting || !file}
            onClick={handleSubmit}
            data-testid="upload-document-submit"
          >
            Upload Document
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 p-4" noValidate data-testid="upload-document-modal">
        {error && (
          <div
            className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-input font-medium"
            role="alert"
          >
            {error}
          </div>
        )}

        {/* File Picker with mobile camera support */}
        <FormField label="Document File" htmlFor="document-file" required>
          <div className="flex flex-col items-center justify-center p-4 sm:p-6 border-2 border-dashed border-border-strong rounded-card bg-surface-muted hover:border-primary-strong transition-colors cursor-pointer text-center relative">
            <input
              id="document-file"
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={handleFileChange}
              disabled={isSubmitting}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
            <svg
              className="w-8 h-8 text-primary-strong mb-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <p className="text-xs sm:text-sm font-semibold text-text">
              {file ? file.name : 'Tap or drag a file to upload'}
            </p>
            <p className="text-[11px] text-text-muted mt-0.5">
              PDF, PNG, or JPEG (up to 10 MB). Camera capture supported on mobile.
            </p>
          </div>
        </FormField>

        {/* Title */}
        <FormField label="Title" htmlFor="document-title" required>
          <Input
            id="document-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Passport Copy, Degree Certificate"
            disabled={isSubmitting}
          />
        </FormField>

        {/* Document Type */}
        <FormField label="Document Type" htmlFor="document-type" required>
          <Select
            id="document-type"
            value={documentType}
            options={DOCUMENT_TYPE_OPTIONS}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
            disabled={isSubmitting}
          />
        </FormField>

        {/* Sensitivity Flag (HR/Admin only) */}
        {canSetSensitive && (
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="document-sensitive"
              type="checkbox"
              checked={isSensitive}
              onChange={(e) => setIsSensitive(e.target.checked)}
              disabled={isSubmitting}
              className="mt-1 w-4 h-4 text-primary-strong rounded border-border-strong focus:ring-primary-strong"
            />
            <label htmlFor="document-sensitive" className="text-xs text-text select-none cursor-pointer">
              <span className="font-semibold block">Mark as Sensitive Document</span>
              <span className="text-text-muted block text-[11px]">
                Restricts view access to HR managers and administrators.
              </span>
            </label>
          </div>
        )}
      </form>
    </Modal>
  );
}
