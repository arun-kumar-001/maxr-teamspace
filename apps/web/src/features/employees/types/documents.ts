export type DocumentType =
  | 'id_proof'
  | 'address_proof'
  | 'education_certificate'
  | 'experience_letter'
  | 'offer_letter'
  | 'contract'
  | 'tax_document'
  | 'other';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  id_proof: 'ID Proof',
  address_proof: 'Address Proof',
  education_certificate: 'Education Certificate',
  experience_letter: 'Experience Letter',
  offer_letter: 'Offer Letter',
  contract: 'Contract',
  tax_document: 'Tax Document',
  other: 'Other',
};

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
  createdAt: string;
  updatedAt: string;
}

export interface UploadDocumentParams {
  employeeId: string;
  file: File;
  documentType: DocumentType;
  title: string;
  isSensitive?: boolean;
}

