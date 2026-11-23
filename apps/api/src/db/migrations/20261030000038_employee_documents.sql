-- Employee documents storage and metadata (#25, decision D-10, D-25).
--
--   * Tracks documents uploaded for employees (ID proof, contracts, certificates, etc.)
--   * Binary files stored in private storage (storage_key); clients access via ephemeral signed links
--   * Sensitive documents flagged via is_sensitive for explicit access control
--   * Duplicate files (same SHA-256 for same employee) rejected
--   * Soft-delete with deleted_at and deleted_by_employee_id preserves audit trail

CREATE TABLE employee_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  uploaded_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  document_type VARCHAR(50) NOT NULL,
  title VARCHAR(200) NOT NULL,
  is_sensitive BOOLEAN NOT NULL DEFAULT false,
  storage_key VARCHAR(300) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  deleted_at TIMESTAMPTZ,
  deleted_by_employee_id UUID REFERENCES employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_emp_doc_size CHECK (size_bytes > 0),
  CONSTRAINT chk_emp_doc_sha256 CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT chk_emp_doc_key_unique UNIQUE (storage_key),
  CONSTRAINT chk_emp_doc_title_not_blank CHECK (char_length(btrim(title)) > 0)
);

-- Active documents for an employee (excludes soft-deleted)
CREATE INDEX idx_employee_documents_active ON employee_documents (employee_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- FK index on uploader
CREATE INDEX idx_employee_documents_uploader ON employee_documents (uploaded_by_employee_id);

-- Enforce duplicate protection: same document (SHA-256) cannot be added twice to same employee
CREATE UNIQUE INDEX idx_employee_documents_sha256_active ON employee_documents (employee_id, sha256)
  WHERE deleted_at IS NULL;

