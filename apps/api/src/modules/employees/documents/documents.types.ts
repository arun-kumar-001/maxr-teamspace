import type { Role } from '@maxr/shared';

export const DOCUMENT_TYPES = [
  'id_proof',
  'address_proof',
  'education_certificate',
  'experience_letter',
  'offer_letter',
  'contract',
  'tax_document',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface EmployeeDocumentRecord {
  id: string;
  employeeId: string;
  uploadedByEmployeeId: string;
  documentType: DocumentType;
  title: string;
  isSensitive: boolean;
  storageKey: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  deletedAt: Date | null;
  deletedByEmployeeId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmployeeDocumentSummary {
  id: string;
  employeeId: string;
  uploadedByEmployeeId: string;
  documentType: DocumentType;
  title: string;
  isSensitive: boolean;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDocumentInput {
  employeeId: string;
  uploadedByEmployeeId: string;
  documentType: DocumentType;
  title: string;
  isSensitive?: boolean;
  filename: string;
  declaredType: string;
  body: Buffer;
}

export interface ListDocumentsQuery {
  documentType?: DocumentType;
  includeSensitive?: boolean;
}

export interface DocumentCaller {
  actorId: string;
  employeeId?: string;
  roles: readonly Role[];
  requestId?: string;
}

export interface DownloadLinkResult {
  url: string;
  expiresAt: string;
}
