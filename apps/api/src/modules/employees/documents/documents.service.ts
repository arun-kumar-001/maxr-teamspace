import { ROLES } from '@maxr/shared';
import { conflict, forbidden, notFound } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import type { IEmployeeDocumentsRepository } from './documents.repository';
import type {
  CreateDocumentInput,
  DocumentCaller,
  DownloadLinkResult,
  EmployeeDocumentRecord,
  EmployeeDocumentSummary,
  ListDocumentsQuery,
} from './documents.types';

function mapToSummary(doc: EmployeeDocumentRecord): EmployeeDocumentSummary {
  return {
    id: doc.id,
    employeeId: doc.employeeId,
    uploadedByEmployeeId: doc.uploadedByEmployeeId,
    documentType: doc.documentType,
    title: doc.title,
    isSensitive: doc.isSensitive,
    originalName: doc.originalName,
    contentType: doc.contentType,
    sizeBytes: doc.sizeBytes,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export class EmployeeDocumentsService {
  constructor(
    private readonly repository: IEmployeeDocumentsRepository,
    private readonly platform: PlatformServices,
  ) {}

  private assertScope(caller: DocumentCaller, targetEmployeeId: string): void {
    const isHrOrAdmin =
      caller.roles.includes(ROLES.ADMIN) || caller.roles.includes(ROLES.HR_MANAGER);

    if (isHrOrAdmin) {
      return;
    }

    // Staff can only access their own records
    if (caller.roles.includes(ROLES.STAFF) && caller.employeeId === targetEmployeeId) {
      return;
    }

    // Any other caller (or Staff attempting to access another's records) gets 404 (AGENTS.md §5 & §7)
    throw notFound('Employee record not found');
  }

  async listDocuments(
    caller: DocumentCaller,
    employeeId: string,
    filter?: ListDocumentsQuery,
  ): Promise<EmployeeDocumentSummary[]> {
    this.assertScope(caller, employeeId);

    return this.repository.transaction(async (tx) => {
      const emp = await this.repository.findEmployeeById(tx, employeeId);
      if (!emp) {
        throw notFound('Employee record not found');
      }

      const docs = await this.repository.listDocuments(tx, employeeId, {
        documentType: filter?.documentType,
      });

      return docs.map(mapToSummary);
    });
  }

  async uploadDocument(
    caller: DocumentCaller,
    input: CreateDocumentInput,
  ): Promise<EmployeeDocumentSummary> {
    this.assertScope(caller, input.employeeId);

    // 1. Upload file to platform storage service (validates size, mime, magic bytes, virus scan)
    const stored = await this.platform.storage.upload({
      category: 'employeeDocuments',
      filename: input.filename,
      declaredType: input.declaredType,
      body: input.body,
      uploadedBy: caller.actorId,
    });

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    try {
      const result = await this.repository.transaction(async (tx) => {
        const emp = await this.repository.findEmployeeById(tx, input.employeeId);
        if (!emp) {
          throw notFound('Employee record not found');
        }

        // 2. Enforce duplicate check per employee (same SHA-256)
        const duplicate = await this.repository.findDocumentBySha256(
          tx,
          input.employeeId,
          stored.sha256,
        );
        if (duplicate) {
          throw conflict('This document has already been uploaded for this employee');
        }

        const inserted = await this.repository.insertDocument(tx, {
          employeeId: input.employeeId,
          uploadedByEmployeeId: input.uploadedByEmployeeId,
          documentType: input.documentType,
          title: input.title,
          isSensitive: Boolean(input.isSensitive),
          storageKey: stored.key,
          originalName: stored.originalName,
          contentType: stored.contentType,
          sizeBytes: stored.size,
          sha256: stored.sha256,
        });

        await audit.record(
          {
            action: 'documents.upload',
            outcome: 'success',
            entityType: 'employee_document',
            entityId: inserted.id,
            metadata: {
              employeeId: input.employeeId,
              documentType: input.documentType,
              isSensitive: Boolean(input.isSensitive),
              sizeBytes: stored.size,
              contentType: stored.contentType,
            },
          },
          { transaction: tx },
        );

        return inserted;
      });

      return mapToSummary(result);
    } catch (err) {
      // If DB insert failed (e.g. duplicate or error), cleanup the uploaded storage object
      try {
        await this.platform.storage.delete(stored.key);
      } catch {
        // Storage cleanup best effort
      }
      throw err;
    }
  }

  async createDownloadLink(
    caller: DocumentCaller,
    employeeId: string,
    documentId: string,
  ): Promise<DownloadLinkResult> {
    this.assertScope(caller, employeeId);

    const doc = await this.repository.transaction(async (tx) => {
      const emp = await this.repository.findEmployeeById(tx, employeeId);
      if (!emp) {
        throw notFound('Employee record not found');
      }

      const document = await this.repository.findDocumentById(tx, documentId, employeeId);
      if (!document) {
        throw notFound('Document not found');
      }
      return document;
    });

    // Short-lived ephemeral download link (15 minutes = 900 seconds) bound to caller's actorId
    const link = await this.platform.storage.createDownloadLink(doc.storageKey, {
      subject: caller.actorId,
      ttlSeconds: 900,
    });

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    await audit.record({
      action: 'documents.download_link',
      outcome: 'success',
      entityType: 'employee_document',
      entityId: doc.id,
      metadata: {
        employeeId,
        documentType: doc.documentType,
      },
    });

    return {
      url: link.url,
      expiresAt: link.expiresAt,
    };
  }

  async deleteDocument(
    caller: DocumentCaller,
    employeeId: string,
    documentId: string,
  ): Promise<void> {
    const isHrOrAdmin =
      caller.roles.includes(ROLES.ADMIN) || caller.roles.includes(ROLES.HR_MANAGER);

    if (!isHrOrAdmin) {
      throw forbidden('Only an Administrator or HR Manager can delete employee documents');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    await this.repository.transaction(async (tx) => {
      const emp = await this.repository.findEmployeeById(tx, employeeId);
      if (!emp) {
        throw notFound('Employee record not found');
      }

      const document = await this.repository.findDocumentById(tx, documentId, employeeId);
      if (!document) {
        throw notFound('Document not found');
      }

      const deleted = await this.repository.softDeleteDocument(
        tx,
        documentId,
        caller.employeeId ?? caller.actorId,
      );

      if (!deleted) {
        throw notFound('Document not found');
      }

      await audit.record(
        {
          action: 'documents.delete',
          outcome: 'success',
          entityType: 'employee_document',
          entityId: documentId,
          metadata: {
            employeeId,
            documentType: document.documentType,
          },
        },
        { transaction: tx },
      );
    });
  }
}
