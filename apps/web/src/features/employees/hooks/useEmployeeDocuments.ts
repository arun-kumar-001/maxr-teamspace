import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  deleteEmployeeDocument,
  fetchDocumentDownloadLink,
  fetchEmployeeDocuments,
  uploadEmployeeDocument,
} from '../api/documents';
import type { DocumentType, EmployeeDocumentSummary } from '../types/documents';

export interface UseEmployeeDocumentsResult {
  documents: EmployeeDocumentSummary[];
  isLoading: boolean;
  error: string | null;
  statusCode: number | null;
  filterType: DocumentType | undefined;
  setFilterType: (type: DocumentType | undefined) => void;
  refetch: () => Promise<void>;
  upload: (
    file: File,
    meta: { documentType: DocumentType; title: string; isSensitive?: boolean },
  ) => Promise<EmployeeDocumentSummary>;
  download: (docId: string) => Promise<string>;
  remove: (docId: string) => Promise<void>;
}

export function useEmployeeDocuments(employeeId: string | null): UseEmployeeDocumentsResult {
  const [documents, setDocuments] = useState<EmployeeDocumentSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<DocumentType | undefined>(undefined);

  const loadDocuments = useCallback(async () => {
    if (!employeeId) {
      setDocuments([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const data = await fetchEmployeeDocuments(employeeId, {
        documentType: filterType,
      });
      setDocuments(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred while loading documents');
        setStatusCode(500);
      }
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, filterType]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const upload = useCallback(
    async (
      file: File,
      meta: { documentType: DocumentType; title: string; isSensitive?: boolean },
    ) => {
      if (!employeeId) throw new Error('Employee ID is required');
      const newDoc = await uploadEmployeeDocument({
        employeeId,
        file,
        documentType: meta.documentType,
        title: meta.title,
        isSensitive: meta.isSensitive,
      });
      setDocuments((prev) => [newDoc, ...prev]);
      return newDoc;
    },
    [employeeId],
  );

  const download = useCallback(
    async (docId: string) => {
      if (!employeeId) throw new Error('Employee ID is required');
      const { url } = await fetchDocumentDownloadLink(employeeId, docId);
      // Open or trigger download
      if (typeof window !== 'undefined') {
        const a = document.createElement('a');
        a.href = url;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      return url;
    },
    [employeeId],
  );

  const remove = useCallback(
    async (docId: string) => {
      if (!employeeId) throw new Error('Employee ID is required');
      await deleteEmployeeDocument(employeeId, docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    },
    [employeeId],
  );

  return {
    documents,
    isLoading,
    error,
    statusCode,
    filterType,
    setFilterType,
    refetch: loadDocuments,
    upload,
    download,
    remove,
  };
}
