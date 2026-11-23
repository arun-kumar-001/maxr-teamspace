import { apiFetch } from '../../../api/client';
import { ApiError } from './employees';
import type {
  DocumentType,
  EmployeeDocumentSummary,
  UploadDocumentParams,
} from '../types/documents';

export { ApiError };

async function handleApiError(res: Response, defaultMessage: string): Promise<never> {
  let errorMessage = `${defaultMessage} (${res.status})`;
  let errorCode: string | undefined;
  try {
    const errorJson = (await res.json()) as { error?: { message?: string; code?: string } };
    if (errorJson.error?.message) {
      errorMessage = errorJson.error.message;
    }
    errorCode = errorJson.error?.code;
  } catch {
    // Non-JSON response
  }
  throw new ApiError(res.status, errorMessage, errorCode);
}

export async function fetchEmployeeDocuments(
  employeeId: string,
  query?: { documentType?: DocumentType },
): Promise<EmployeeDocumentSummary[]> {
  const params = new URLSearchParams();
  if (query?.documentType) {
    params.set('documentType', query.documentType);
  }

  const queryString = params.toString();
  const url = `/api/v1/employees/${employeeId}/documents${queryString ? `?${queryString}` : ''}`;
  const res = await apiFetch(url);

  if (!res.ok) {
    await handleApiError(res, 'Failed to fetch employee documents');
  }

  const json = (await res.json()) as { data: EmployeeDocumentSummary[] };
  return json.data;
}

export async function uploadEmployeeDocument(
  params: UploadDocumentParams,
): Promise<EmployeeDocumentSummary> {
  const query = new URLSearchParams({
    documentType: params.documentType,
    title: params.title,
    isSensitive: params.isSensitive ? 'true' : 'false',
  });

  const url = `/api/v1/employees/${params.employeeId}/documents?${query.toString()}`;

  const res = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': params.file.type || 'application/pdf',
      'X-Filename': encodeURIComponent(params.file.name),
      'X-Document-Type': params.documentType,
      'X-Document-Title': encodeURIComponent(params.title),
      'X-Is-Sensitive': params.isSensitive ? 'true' : 'false',
    },
    body: params.file,
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to upload document');
  }

  const json = (await res.json()) as { data: EmployeeDocumentSummary };
  return json.data;
}

export async function fetchDocumentDownloadLink(
  employeeId: string,
  docId: string,
): Promise<{ url: string; expiresAt: string }> {
  const res = await apiFetch(`/api/v1/employees/${employeeId}/documents/${docId}/download-link`);

  if (!res.ok) {
    await handleApiError(res, 'Failed to generate download link');
  }

  const json = (await res.json()) as { data: { url: string; expiresAt: string } };
  return json.data;
}

export async function deleteEmployeeDocument(employeeId: string, docId: string): Promise<void> {
  const res = await apiFetch(`/api/v1/employees/${employeeId}/documents/${docId}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    await handleApiError(res, 'Failed to delete document');
  }
}
