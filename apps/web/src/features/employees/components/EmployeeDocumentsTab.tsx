import { useState } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  ForbiddenState,
  Select,
  Skeleton,
} from '../../../components/ui';
import { useEmployeeDocuments } from '../hooks/useEmployeeDocuments';
import {
  DOCUMENT_TYPE_LABELS,
  type DocumentType,
  type EmployeeDocumentSummary,
} from '../types/documents';
import { DeleteDocumentModal } from './DeleteDocumentModal';
import { DocumentTypeBadge } from './DocumentTypeBadge';
import { UploadDocumentModal } from './UploadDocumentModal';

export interface EmployeeDocumentsTabProps {
  employeeId: string;
  employeeName?: string;
  canUpload?: boolean;
  canDelete?: boolean;
  canSetSensitive?: boolean;
}

const FILTER_OPTIONS = [
  { value: '', label: 'All Document Types' },
  ...Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EmployeeDocumentsTab({
  employeeId,
  employeeName,
  canUpload = true,
  canDelete = false,
  canSetSensitive = false,
}: EmployeeDocumentsTabProps) {
  const {
    documents,
    isLoading,
    error,
    statusCode,
    filterType,
    setFilterType,
    refetch,
    upload,
    download,
    remove,
  } = useEmployeeDocuments(employeeId);

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [deletingDoc, setDeletingDoc] = useState<EmployeeDocumentSummary | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleDownload = async (docId: string) => {
    setDownloadingId(docId);
    try {
      await download(docId);
      setToastMessage('Download link generated. File opening...');
    } catch {
      setToastMessage('Failed to download document.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (statusCode === 403) {
    return (
      <div className="p-4" data-testid="documents-tab-forbidden">
        <ForbiddenState
          title="Access Restricted"
          message="You do not have permission to view this employee's documents."
        />
      </div>
    );
  }

  if (error && !isLoading && documents.length === 0) {
    return (
      <div className="p-4" data-testid="documents-tab-error">
        <ErrorState title="Failed to Load Documents" message={error} onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="employee-documents-tab">
      {/* Tab Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border">
        <div className="flex items-center gap-2">
          <h2 className="text-base sm:text-lg font-bold text-text font-display">
            {employeeName
              ? employeeName === 'My'
                ? 'My Documents'
                : `${employeeName}'s Documents`
              : 'Documents'}
          </h2>
          {!isLoading && (
            <Badge variant="primary" data-testid="documents-count-badge">
              {documents.length} {documents.length === 1 ? 'File' : 'Files'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-48 sm:w-56">
            <Select
              options={FILTER_OPTIONS}
              value={filterType || ''}
              onChange={(e) => setFilterType((e.target.value as DocumentType) || undefined)}
              aria-label="Filter documents by type"
            />
          </div>

          {canUpload && (
            <Button
              variant="primary"
              size="md"
              onClick={() => setIsUploadOpen(true)}
              data-testid="upload-document-button"
            >
              Upload Document
            </Button>
          )}
        </div>
      </div>

      {toastMessage && (
        <div className="p-3 bg-primary-soft text-primary-ink border border-primary-soft-border text-xs rounded-tile flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            type="button"
            className="text-primary-strong font-bold ml-2"
            onClick={() => setToastMessage(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Loading Skeletons */}
      {isLoading ? (
        <div className="space-y-3" data-testid="documents-loading">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="p-4 bg-surface rounded-tile border border-border flex items-center justify-between"
            >
              <div className="space-y-2 w-1/2">
                <Skeleton height={18} width="70%" />
                <Skeleton height={14} width="40%" />
              </div>
              <Skeleton height={36} width={90} />
            </div>
          ))}
        </div>
      ) : documents.length === 0 ? (
        <div data-testid="documents-empty-state">
          <EmptyState
            title="No Documents Uploaded"
            description={
              filterType
                ? 'No documents found matching the selected type filter.'
                : 'There are no active documents on record for this employee.'
            }
            actionLabel={canUpload ? 'Upload First Document' : undefined}
            onAction={canUpload ? () => setIsUploadOpen(true) : undefined}
          />
        </div>
      ) : (
        <>
          {/* Mobile Cards (<640px) */}
          <div className="block sm:hidden space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="p-4 bg-surface rounded-tile border border-border space-y-3 shadow-card"
                data-testid={`document-card-${doc.id}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-text text-sm">{doc.title}</h3>
                    <p className="text-xs font-mono text-text-muted mt-0.5 truncate max-w-[200px]">
                      {doc.originalName}
                    </p>
                  </div>
                  <DocumentTypeBadge type={doc.documentType} isSensitive={doc.isSensitive} />
                </div>

                <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border">
                  <span>{formatBytes(doc.sizeBytes)}</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    isLoading={downloadingId === doc.id}
                    onClick={() => handleDownload(doc.id)}
                    data-testid={`download-doc-mobile-${doc.id}`}
                  >
                    Download
                  </Button>
                  {canDelete && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingDoc(doc)}
                      data-testid={`delete-doc-mobile-${doc.id}`}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop / Tablet Table (>=640px) */}
          <div className="hidden sm:block overflow-hidden rounded-tile border border-border bg-surface">
            <table className="min-w-full divide-y divide-border text-left">
              <thead className="bg-surface-muted text-xs font-semibold text-text-muted uppercase tracking-wider">
                <tr>
                  <th scope="col" className="px-4 py-3">
                    Document Title
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Category
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Size
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Uploaded
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {documents.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-surface-muted/50 transition-colors"
                    data-testid={`document-row-${doc.id}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-text">{doc.title}</div>
                      <div className="text-xs text-text-muted font-mono">{doc.originalName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <DocumentTypeBadge type={doc.documentType} isSensitive={doc.isSensitive} />
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted font-mono">
                      {formatBytes(doc.sizeBytes)}
                    </td>
                    <td className="px-4 py-3 text-xs text-text-muted">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          isLoading={downloadingId === doc.id}
                          onClick={() => handleDownload(doc.id)}
                          data-testid={`download-doc-${doc.id}`}
                        >
                          Download
                        </Button>
                        {canDelete && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingDoc(doc)}
                            data-testid={`delete-doc-${doc.id}`}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Upload Modal */}
      <UploadDocumentModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={upload}
        canSetSensitive={canSetSensitive}
      />

      {/* Delete Confirmation Modal */}
      <DeleteDocumentModal
        isOpen={Boolean(deletingDoc)}
        onClose={() => setDeletingDoc(null)}
        document={deletingDoc}
        onConfirmDelete={remove}
      />
    </div>
  );
}
