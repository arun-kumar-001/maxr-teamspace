import { ROLES } from '@maxr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PlatformServices } from '../../../platform';
import { InMemoryEmployeeDocumentsRepository } from './documents.repository.memory';
import { EmployeeDocumentsService } from './documents.service';
import type { DocumentCaller } from './documents.types';

function createPlatformMock() {
  const auditEntries: Array<{ action: string; outcome: string; metadata?: unknown }> = [];
  const storedFiles = new Map<string, { key: string; body: Buffer }>();

  const storage = {
    upload: async (req: {
      category: string;
      filename: string;
      declaredType: string;
      body: Buffer;
    }) => {
      const key = `employee-documents/2026/11/${Date.now()}-${req.filename}`;
      storedFiles.set(key, { key, body: req.body });
      return {
        key,
        size: req.body.length,
        contentType: req.declaredType || 'application/pdf',
        sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        originalName: req.filename,
      };
    },
    createDownloadLink: async (key: string, options: { subject: string; ttlSeconds?: number }) => {
      return {
        url: `/api/v1/files/download?token=signed-token-for-${key}-user-${options.subject}`,
        expiresAt: new Date(Date.now() + (options.ttlSeconds ?? 900) * 1000).toISOString(),
      };
    },
    delete: async (key: string) => {
      storedFiles.delete(key);
      return true;
    },
    exists: async (key: string) => storedFiles.has(key),
    openDownload: async () => ({ ok: false as const, reason: 'not_found' as const }),
  };

  const audit = {
    record: async (entry: { action: string; outcome: string; metadata?: unknown }) => {
      auditEntries.push(entry);
    },
    tryRecord: async (entry: { action: string; outcome: string; metadata?: unknown }) => {
      auditEntries.push(entry);
    },
    withContext: () => ({
      record: async (
        entry: { action: string; outcome: string; metadata?: unknown },
        _opts?: unknown,
      ) => {
        auditEntries.push(entry);
      },
      tryRecord: async () => {},
    }),
  };

  return {
    storage: storage as unknown as PlatformServices['storage'],
    audit: audit as unknown as PlatformServices['audit'],
    events: {} as unknown as PlatformServices['events'],
    notifications: {} as unknown as PlatformServices['notifications'],
    entries: auditEntries,
    storedFiles,
  };
}

describe('EmployeeDocumentsService (D1-08, #25)', () => {
  let repository: InMemoryEmployeeDocumentsRepository;
  let platformMock: ReturnType<typeof createPlatformMock>;
  let service: EmployeeDocumentsService;

  const hrCaller: DocumentCaller = {
    actorId: 'user-hr-1',
    employeeId: 'emp-hr-1',
    roles: [ROLES.HR_MANAGER],
  };

  const staffCaller: DocumentCaller = {
    actorId: 'user-staff-1',
    employeeId: 'emp-staff-1',
    roles: [ROLES.STAFF],
  };

  const leadCaller: DocumentCaller = {
    actorId: 'user-lead-1',
    employeeId: 'emp-lead-1',
    roles: [ROLES.TEAM_LEAD],
  };

  beforeEach(() => {
    repository = new InMemoryEmployeeDocumentsRepository();
    platformMock = createPlatformMock();
    service = new EmployeeDocumentsService(repository, platformMock);

    // Seed test employees
    repository.seedEmployee({ id: 'emp-staff-1', status: 'active' });
    repository.seedEmployee({ id: 'emp-staff-2', status: 'active' });
    repository.seedEmployee({ id: 'emp-hr-1', status: 'active' });
  });

  describe('listDocuments', () => {
    it('HR Manager can list documents for any employee', async () => {
      const docs = await service.listDocuments(hrCaller, 'emp-staff-1');
      expect(docs).toEqual([]);
    });

    it('Staff can list their own documents', async () => {
      const docs = await service.listDocuments(staffCaller, 'emp-staff-1');
      expect(docs).toEqual([]);
    });

    it('Staff gets 404 when attempting to list another employee documents', async () => {
      await expect(service.listDocuments(staffCaller, 'emp-staff-2')).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 }),
      );
    });

    it('Team Lead gets 404 (denied by default for employee personal docs)', async () => {
      await expect(service.listDocuments(leadCaller, 'emp-staff-1')).rejects.toThrowError(
        expect.objectContaining({ statusCode: 404 }),
      );
    });
  });

  describe('uploadDocument', () => {
    it('HR Manager can upload document for an employee and records audit log', async () => {
      const doc = await service.uploadDocument(hrCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: hrCaller.employeeId!,
        documentType: 'id_proof',
        title: 'Passport Copy',
        isSensitive: true,
        filename: 'passport.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 mock content'),
      });

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe('Passport Copy');
      expect(doc.documentType).toBe('id_proof');
      expect(doc.isSensitive).toBe(true);
      expect(doc.originalName).toBe('passport.pdf');

      // Audit entry recorded
      const uploadAudit = platformMock.entries.find((e) => e.action === 'documents.upload');
      expect(uploadAudit).toBeDefined();
      expect(uploadAudit?.outcome).toBe('success');
    });

    it('Staff can upload document to own profile', async () => {
      const doc = await service.uploadDocument(staffCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: staffCaller.employeeId!,
        documentType: 'education_certificate',
        title: 'Degree Certificate',
        filename: 'degree.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 degree content'),
      });

      expect(doc.id).toBeDefined();
      expect(doc.employeeId).toBe('emp-staff-1');
    });

    it('Staff gets 404 when attempting to upload to another employee profile', async () => {
      await expect(
        service.uploadDocument(staffCaller, {
          employeeId: 'emp-staff-2',
          uploadedByEmployeeId: staffCaller.employeeId!,
          documentType: 'id_proof',
          title: 'Illegal upload',
          filename: 'hacked.pdf',
          declaredType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 test'),
        }),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 404 }));
    });

    it('rejects duplicate document upload (same SHA-256 for same employee) with 409', async () => {
      // First upload
      await service.uploadDocument(hrCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: hrCaller.employeeId!,
        documentType: 'id_proof',
        title: 'Passport Copy',
        filename: 'passport.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 same bytes'),
      });

      // Second upload with identical bytes
      await expect(
        service.uploadDocument(hrCaller, {
          employeeId: 'emp-staff-1',
          uploadedByEmployeeId: hrCaller.employeeId!,
          documentType: 'id_proof',
          title: 'Duplicate Passport',
          filename: 'passport.pdf',
          declaredType: 'application/pdf',
          body: Buffer.from('%PDF-1.4 same bytes'),
        }),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 409 }));
    });
  });

  describe('createDownloadLink', () => {
    it('generates ephemeral signed link bound to user session', async () => {
      const doc = await service.uploadDocument(hrCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: hrCaller.employeeId!,
        documentType: 'contract',
        title: 'Employment Agreement',
        filename: 'agreement.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 test'),
      });

      const link = await service.createDownloadLink(staffCaller, 'emp-staff-1', doc.id);
      expect(link.url).toContain('/api/v1/files/download?token=');
      expect(link.expiresAt).toBeDefined();

      const downloadAudit = platformMock.entries.find(
        (e) => e.action === 'documents.download_link',
      );
      expect(downloadAudit).toBeDefined();
    });

    it('returns 404 if document does not exist', async () => {
      await expect(
        service.createDownloadLink(
          staffCaller,
          'emp-staff-1',
          '00000000-0000-0000-0000-000000000099',
        ),
      ).rejects.toThrowError(expect.objectContaining({ statusCode: 404 }));
    });
  });

  describe('deleteDocument', () => {
    it('HR Manager can soft-delete a document', async () => {
      const doc = await service.uploadDocument(hrCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: hrCaller.employeeId!,
        documentType: 'tax_document',
        title: 'Tax Declaration',
        filename: 'tax.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 tax'),
      });

      await service.deleteDocument(hrCaller, 'emp-staff-1', doc.id);

      // Excluded from listing
      const docs = await service.listDocuments(hrCaller, 'emp-staff-1');
      expect(docs.find((d) => d.id === doc.id)).toBeUndefined();

      const deleteAudit = platformMock.entries.find((e) => e.action === 'documents.delete');
      expect(deleteAudit).toBeDefined();
    });

    it('Staff is forbidden from deleting documents (403)', async () => {
      const doc = await service.uploadDocument(hrCaller, {
        employeeId: 'emp-staff-1',
        uploadedByEmployeeId: hrCaller.employeeId!,
        documentType: 'offer_letter',
        title: 'Offer Letter',
        filename: 'offer.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 offer'),
      });

      await expect(service.deleteDocument(staffCaller, 'emp-staff-1', doc.id)).rejects.toThrowError(
        expect.objectContaining({ statusCode: 403 }),
      );
    });
  });
});
