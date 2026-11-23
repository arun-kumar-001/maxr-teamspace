import { randomUUID } from 'crypto';
import type { DocumentsTx, IEmployeeDocumentsRepository } from './documents.repository';
import type { DocumentType, EmployeeDocumentRecord } from './documents.types';

export class InMemoryEmployeeDocumentsRepository implements IEmployeeDocumentsRepository {
  private employees = new Map<string, { id: string; status: string }>();
  private documents = new Map<string, EmployeeDocumentRecord>();

  async transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T> {
    return work({} as DocumentsTx);
  }

  seedEmployee(employee: { id: string; status: string }): void {
    this.employees.set(employee.id, employee);
  }

  seedDocument(doc: EmployeeDocumentRecord): void {
    this.documents.set(doc.id, doc);
  }

  async findEmployeeById(
    _tx: DocumentsTx,
    employeeId: string,
  ): Promise<{ id: string; status: string } | null> {
    return this.employees.get(employeeId) ?? null;
  }

  async listDocuments(
    _tx: DocumentsTx,
    employeeId: string,
    filter?: { documentType?: DocumentType },
  ): Promise<EmployeeDocumentRecord[]> {
    return Array.from(this.documents.values())
      .filter((doc) => {
        if (doc.employeeId !== employeeId) return false;
        if (doc.deletedAt !== null) return false;
        if (filter?.documentType && doc.documentType !== filter.documentType) return false;
        return true;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findDocumentById(
    _tx: DocumentsTx,
    documentId: string,
    employeeId?: string,
  ): Promise<EmployeeDocumentRecord | null> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.deletedAt !== null) return null;
    if (employeeId && doc.employeeId !== employeeId) return null;
    return doc;
  }

  async findDocumentBySha256(
    _tx: DocumentsTx,
    employeeId: string,
    sha256: string,
  ): Promise<EmployeeDocumentRecord | null> {
    for (const doc of this.documents.values()) {
      if (doc.employeeId === employeeId && doc.sha256 === sha256 && doc.deletedAt === null) {
        return doc;
      }
    }
    return null;
  }

  async insertDocument(
    _tx: DocumentsTx,
    doc: {
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
    },
  ): Promise<EmployeeDocumentRecord> {
    const id = randomUUID();
    const now = new Date();
    const record: EmployeeDocumentRecord = {
      ...doc,
      id,
      deletedAt: null,
      deletedByEmployeeId: null,
      createdAt: now,
      updatedAt: now,
    };
    this.documents.set(id, record);
    return record;
  }

  async softDeleteDocument(
    _tx: DocumentsTx,
    documentId: string,
    deletedByEmployeeId: string,
  ): Promise<EmployeeDocumentRecord | null> {
    const doc = this.documents.get(documentId);
    if (!doc || doc.deletedAt !== null) return null;

    const updated: EmployeeDocumentRecord = {
      ...doc,
      deletedAt: new Date(),
      deletedByEmployeeId,
      updatedAt: new Date(),
    };
    this.documents.set(documentId, updated);
    return updated;
  }
}
