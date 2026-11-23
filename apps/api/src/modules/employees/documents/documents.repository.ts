import type { Pool, PoolClient } from 'pg';
import type { DocumentType, EmployeeDocumentRecord } from './documents.types';

export type DocumentsTx = Pool | PoolClient;

export interface IEmployeeDocumentsRepository {
  transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T>;
  findEmployeeById(
    tx: DocumentsTx,
    employeeId: string,
  ): Promise<{ id: string; status: string } | null>;
  listDocuments(
    tx: DocumentsTx,
    employeeId: string,
    filter?: { documentType?: DocumentType },
  ): Promise<EmployeeDocumentRecord[]>;
  findDocumentById(
    tx: DocumentsTx,
    documentId: string,
    employeeId?: string,
  ): Promise<EmployeeDocumentRecord | null>;
  findDocumentBySha256(
    tx: DocumentsTx,
    employeeId: string,
    sha256: string,
  ): Promise<EmployeeDocumentRecord | null>;
  insertDocument(
    tx: DocumentsTx,
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
  ): Promise<EmployeeDocumentRecord>;
  softDeleteDocument(
    tx: DocumentsTx,
    documentId: string,
    deletedByEmployeeId: string,
  ): Promise<EmployeeDocumentRecord | null>;
}

interface DocumentRow {
  id: string;
  employee_id: string;
  uploaded_by_employee_id: string;
  document_type: string;
  title: string;
  is_sensitive: boolean;
  storage_key: string;
  original_name: string;
  content_type: string;
  size_bytes: number;
  sha256: string;
  deleted_at: Date | null;
  deleted_by_employee_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapRow(row: DocumentRow): EmployeeDocumentRecord {
  return {
    id: row.id,
    employeeId: row.employee_id,
    uploadedByEmployeeId: row.uploaded_by_employee_id,
    documentType: row.document_type as DocumentType,
    title: row.title,
    isSensitive: row.is_sensitive,
    storageKey: row.storage_key,
    originalName: row.original_name,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    sha256: row.sha256,
    deletedAt: row.deleted_at,
    deletedByEmployeeId: row.deleted_by_employee_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PgEmployeeDocumentsRepository implements IEmployeeDocumentsRepository {
  constructor(private readonly pool: Pool) {}

  async transaction<T>(work: (tx: DocumentsTx) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findEmployeeById(
    tx: DocumentsTx,
    employeeId: string,
  ): Promise<{ id: string; status: string } | null> {
    const res = await tx.query<{ id: string; status: string }>(
      `SELECT id, status FROM employees WHERE id = $1`,
      [employeeId],
    );
    return res.rows[0] ?? null;
  }

  async listDocuments(
    tx: DocumentsTx,
    employeeId: string,
    filter?: { documentType?: DocumentType },
  ): Promise<EmployeeDocumentRecord[]> {
    const conditions = ['employee_id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [employeeId];

    if (filter?.documentType) {
      params.push(filter.documentType);
      conditions.push(`document_type = $${params.length}`);
    }

    const query = `
      SELECT *
        FROM employee_documents
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at DESC
    `;

    const res = await tx.query<DocumentRow>(query, params);
    return res.rows.map(mapRow);
  }

  async findDocumentById(
    tx: DocumentsTx,
    documentId: string,
    employeeId?: string,
  ): Promise<EmployeeDocumentRecord | null> {
    const conditions = ['id = $1', 'deleted_at IS NULL'];
    const params: unknown[] = [documentId];

    if (employeeId) {
      params.push(employeeId);
      conditions.push(`employee_id = $${params.length}`);
    }

    const res = await tx.query<DocumentRow>(
      `SELECT * FROM employee_documents WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async findDocumentBySha256(
    tx: DocumentsTx,
    employeeId: string,
    sha256: string,
  ): Promise<EmployeeDocumentRecord | null> {
    const res = await tx.query<DocumentRow>(
      `SELECT *
         FROM employee_documents
        WHERE employee_id = $1
          AND sha256 = $2
          AND deleted_at IS NULL`,
      [employeeId, sha256],
    );
    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }

  async insertDocument(
    tx: DocumentsTx,
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
    const res = await tx.query<DocumentRow>(
      `INSERT INTO employee_documents (
         employee_id,
         uploaded_by_employee_id,
         document_type,
         title,
         is_sensitive,
         storage_key,
         original_name,
         content_type,
         size_bytes,
         sha256
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        doc.employeeId,
        doc.uploadedByEmployeeId,
        doc.documentType,
        doc.title,
        doc.isSensitive,
        doc.storageKey,
        doc.originalName,
        doc.contentType,
        doc.sizeBytes,
        doc.sha256,
      ],
    );

    const row = res.rows[0];
    if (!row) throw new Error('Failed to insert employee document');
    return mapRow(row);
  }

  async softDeleteDocument(
    tx: DocumentsTx,
    documentId: string,
    deletedByEmployeeId: string,
  ): Promise<EmployeeDocumentRecord | null> {
    const res = await tx.query<DocumentRow>(
      `UPDATE employee_documents
          SET deleted_at = NOW(),
              deleted_by_employee_id = $2,
              updated_at = NOW()
        WHERE id = $1
          AND deleted_at IS NULL
        RETURNING *`,
      [documentId, deletedByEmployeeId],
    );

    return res.rows[0] ? mapRow(res.rows[0]) : null;
  }
}
