import React, { useRef, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import type { ProjectDocument, ProjectDocumentCategory } from '../types';

export interface ProjectDocumentsSectionProps {
  documents: ProjectDocument[];
  currentEmployeeId?: string;
  canManage: boolean;
  isArchived: boolean;
  onUploadDocument: (file: File, category: ProjectDocumentCategory) => Promise<void>;
  onDownloadDocument: (documentId: string) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

const CATEGORY_LABELS: Record<ProjectDocumentCategory, string> = {
  specification: 'Specification',
  architecture: 'Architecture',
  report: 'Report',
  general: 'General',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ProjectDocumentsSection({
  documents,
  currentEmployeeId,
  canManage,
  isArchived,
  onUploadDocument,
  onDownloadDocument,
  onDeleteDocument,
}: ProjectDocumentsSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [category, setCategory] = useState<ProjectDocumentCategory>('general');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyDocId, setBusyDocId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedFile) {
      setError('Select a PDF, PNG, or JPEG file to upload.');
      return;
    }

    setUploading(true);
    try {
      await onUploadDocument(selectedFile, category);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (docId: string) => {
    setError(null);
    setBusyDocId(docId);
    try {
      await onDownloadDocument(docId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to open document download link');
    } finally {
      setBusyDocId(null);
    }
  };

  const handleDelete = async (docId: string) => {
    setError(null);
    setBusyDocId(docId);
    try {
      await onDeleteDocument(docId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to remove document');
    } finally {
      setBusyDocId(null);
    }
  };

  return (
    <div
      className="p-6 border rounded-[24px] flex flex-col gap-5"
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.74)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 10px 28px rgba(85, 205, 179, 0.08)',
      }}
      data-testid="project-documents-section"
    >
      <div>
        <h2 className="font-display text-lg font-bold" style={{ color: 'rgb(8, 11, 12)' }}>
          Important Documents & Attachments ({documents.length})
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          Specs, architecture diagrams, deliverables, and signed project attachments (PDF, PNG, JPEG
          up to 10 MB).
        </p>
      </div>

      {error && (
        <div
          className="p-3 bg-rose-50 border border-rose-200 text-danger text-sm rounded-lg"
          role="alert"
        >
          {error}
        </div>
      )}

      {!isArchived && (
        <form
          onSubmit={handleUpload}
          className="p-4 rounded-2xl border border-border grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          style={{ backgroundColor: 'rgb(244, 247, 246)' }}
        >
          <div className="sm:col-span-5">
            <FormField label="Document File" htmlFor="project-document-file">
              <input
                ref={fileInputRef}
                id="project-document-file"
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                disabled={uploading}
                className="block w-full text-xs text-text file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-soft file:text-primary-ink hover:file:bg-primary/20 cursor-pointer"
              />
            </FormField>
          </div>

          <div className="sm:col-span-4">
            <FormField label="Category" htmlFor="project-document-category">
              <Select
                id="project-document-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as ProjectDocumentCategory)}
                disabled={uploading}
                options={[
                  { value: 'general', label: 'General Attachment' },
                  { value: 'specification', label: 'Specification' },
                  { value: 'architecture', label: 'Architecture' },
                  { value: 'report', label: 'Report' },
                ]}
              />
            </FormField>
          </div>

          <div className="sm:col-span-3 flex justify-end">
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={uploading}
              className="w-full"
              data-testid="upload-project-doc-btn"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <div
          className="p-6 text-center rounded-2xl border border-dashed border-border"
          style={{ backgroundColor: 'rgb(244, 247, 246)' }}
        >
          <p className="text-sm font-medium text-text">No project documents attached yet</p>
          <p className="text-xs text-text-muted mt-1">
            Upload specifications, architecture docs, or progress reports to share with your team.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {documents.map((doc) => {
            const canDelete =
              !isArchived && (canManage || doc.uploadedByEmployeeId === currentEmployeeId);
            const busy = busyDocId === doc.id;
            return (
              <div
                key={doc.id}
                className="p-4 rounded-2xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                style={{ backgroundColor: 'rgb(244, 247, 246)' }}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: 'rgba(85, 205, 179, 0.2)',
                      color: 'rgb(8, 11, 12)',
                    }}
                    aria-hidden="true"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <path d="M14 2v6h6M16 13H8M16 17H8" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text truncate">
                        {doc.originalName}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                        style={{
                          backgroundColor: 'rgba(73, 53, 72, 0.1)',
                          color: 'rgb(73, 53, 72)',
                        }}
                      >
                        {CATEGORY_LABELS[doc.category] ?? doc.category}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {formatFileSize(doc.size)} &middot; Uploaded by {doc.uploadedByName} on{' '}
                      {new Date(doc.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => void handleDownload(doc.id)}
                  >
                    Download
                  </Button>
                  {canDelete && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="text-danger hover:bg-rose-50 hover:border-rose-200"
                      onClick={() => void handleDelete(doc.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
