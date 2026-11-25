import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Skeleton } from '../../../components/ui';
import { useEmployeeDocuments } from '../hooks/useEmployeeDocuments';
import { DOCUMENT_TYPE_LABELS } from '../types/documents';

export interface EmployeeDocumentsCardProps {
  employeeId: string;
}

const formatSize = (bytes: number): string =>
  bytes >= 1024 * 1024
    ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    : `${Math.ceil(bytes / 1024)} KB`;

/**
 * The documents on an employee's record (ID proof, certificates, resume, ...), with a secure link
 * to open each one. The API decides who may list and open them; a person who may not sees why, not
 * an empty list. Upload and delete live on the full documents page.
 */
export function EmployeeDocumentsCard({ employeeId }: EmployeeDocumentsCardProps) {
  const { documents, isLoading, error, statusCode, download, refetch } =
    useEmployeeDocuments(employeeId);
  const [openError, setOpenError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = async (docId: string) => {
    setOpenError(null);
    setOpeningId(docId);
    try {
      await download(docId);
    } catch (err: unknown) {
      setOpenError(err instanceof Error ? err.message : 'The document could not be opened.');
    } finally {
      setOpeningId(null);
    }
  };

  const forbidden = statusCode === 403 || statusCode === 404;

  return (
    <section
      className="bg-surface border border-border rounded-card p-6 shadow-card"
      aria-labelledby="employee-documents-heading"
      data-testid="employee-documents-card"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border pb-4 mb-5">
        <div>
          <h2 id="employee-documents-heading" className="text-base font-semibold text-text">
            Documents
          </h2>
          <p className="text-xs text-text-muted">
            Files on this employee&apos;s record. Links open privately and expire shortly.
          </p>
        </div>
        <Link
          to={`/employees/${employeeId}/documents`}
          className="text-xs font-semibold text-primary-ink hover:underline min-h-[44px] inline-flex items-center"
          data-testid="manage-documents-link"
        >
          Manage documents
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3" data-testid="employee-documents-loading">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : forbidden ? (
        <p className="text-sm text-text-muted" data-testid="employee-documents-forbidden">
          You do not have access to this employee&apos;s documents.
        </p>
      ) : error ? (
        <div className="flex items-center justify-between gap-3" role="alert">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-text-muted" data-testid="employee-documents-empty">
          No documents have been uploaded for this employee.
        </p>
      ) : (
        <ul className="divide-y divide-border" data-testid="employee-documents-list">
          {documents.map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text truncate">{doc.title}</p>
                <p className="text-xs text-text-muted">
                  {DOCUMENT_TYPE_LABELS[doc.documentType]} · {formatSize(doc.sizeBytes)} · Uploaded{' '}
                  {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="min-h-[44px]"
                disabled={openingId === doc.id}
                onClick={() => void open(doc.id)}
                aria-label={`View ${doc.title}`}
              >
                {openingId === doc.id ? 'Opening…' : 'View'}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {openError && (
        <p className="mt-3 text-xs text-danger" role="alert">
          {openError}
        </p>
      )}
    </section>
  );
}
