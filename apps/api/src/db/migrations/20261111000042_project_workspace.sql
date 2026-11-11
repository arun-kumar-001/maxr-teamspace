-- Project workspace details, milestones, updates/comments/activity, and documents.
-- Extends projects with metadata used across employee and manager project views
-- while preserving existing status ('active' | 'archived') lifecycle semantics.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS priority VARCHAR(16) NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  ADD COLUMN IF NOT EXISTS workflow_status VARCHAR(24) NOT NULL DEFAULT 'in_progress'
    CHECK (workflow_status IN ('not_started', 'in_progress', 'on_hold', 'completed')),
  ADD COLUMN IF NOT EXISTS progress_percent INT NOT NULL DEFAULT 0
    CHECK (progress_percent >= 0 AND progress_percent <= 100),
  ADD COLUMN IF NOT EXISTS objectives TEXT,
  ADD COLUMN IF NOT EXISTS scope TEXT,
  ADD COLUMN IF NOT EXISTS technologies JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(technologies) = 'array');

-- Justification: supports employee/manager filtering and sorting by workflow status, priority, and deadline.
CREATE INDEX IF NOT EXISTS idx_projects_workflow_priority
  ON projects (workflow_status, priority, end_date);

CREATE TABLE project_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  due_date DATE,
  status VARCHAR(24) NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'on_hold', 'completed')),
  completion_percent INT NOT NULL DEFAULT 0
    CHECK (completion_percent >= 0 AND completion_percent <= 100),
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_milestones_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT project_milestones_dates_check CHECK (
    start_date IS NULL OR due_date IS NULL OR due_date >= start_date
  )
);

-- Justification: FK index and ordered milestone lookup per project.
CREATE INDEX idx_project_milestones_project
  ON project_milestones (project_id, sort_order, due_date, id);

CREATE TABLE project_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  author_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  update_type VARCHAR(24) NOT NULL
    CHECK (update_type IN ('manager_update', 'progress_update', 'comment', 'activity')),
  content VARCHAR(2000) NOT NULL
    CHECK (char_length(btrim(content)) > 0),
  progress_percent INT
    CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Justification: reverse-chronological feed per project and FK index on author.
CREATE INDEX idx_project_updates_project
  ON project_updates (project_id, created_at DESC, id);
CREATE INDEX idx_project_updates_author
  ON project_updates (author_employee_id);

CREATE TABLE project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  uploaded_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  storage_key VARCHAR(300) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL CHECK (size_bytes > 0),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  category VARCHAR(40) NOT NULL DEFAULT 'general'
    CHECK (category IN ('specification', 'architecture', 'report', 'general')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT project_documents_key_unique UNIQUE (storage_key),
  CONSTRAINT project_documents_once_per_project UNIQUE (project_id, sha256)
);

-- Justification: FK indexes for project document listing and uploader auditing.
CREATE INDEX idx_project_documents_project
  ON project_documents (project_id, created_at DESC, id);
CREATE INDEX idx_project_documents_uploader
  ON project_documents (uploaded_by_employee_id);
