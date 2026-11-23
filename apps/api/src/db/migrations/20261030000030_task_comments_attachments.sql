-- Task comments and attachments (#44, decision D-14).
--
--   * comments are append-only: there is no edit or delete, so a thread stays a record
--   * an attachment row points at a private storage object by key; the same file (SHA-256) is
--     attached to a task once, and a task has a bounded number of files (the service checks the
--     bound under a lock)
--   * access follows the task: whoever can see the task can read its thread and files

CREATE TABLE task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  author_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  body VARCHAR(2000) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_comments_body_not_blank CHECK (char_length(btrim(body)) > 0)
);

-- Justification: a task's thread, oldest first (also the FK index).
CREATE INDEX idx_task_comments_thread ON task_comments (task_id, created_at, id);
-- Justification: FK index.
CREATE INDEX idx_task_comments_author ON task_comments (author_employee_id);

CREATE TABLE task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE RESTRICT,
  uploaded_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  storage_key VARCHAR(300) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT task_attachments_size_check CHECK (size_bytes > 0),
  CONSTRAINT task_attachments_sha256_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT task_attachments_key_unique UNIQUE (storage_key),
  CONSTRAINT task_attachments_once_per_task UNIQUE (task_id, sha256)
);

-- Justification: FK index.
CREATE INDEX idx_task_attachments_uploader ON task_attachments (uploaded_by_employee_id);
