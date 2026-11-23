-- Projects and their members (#42, decision D-14).
--
--   * a project has one owner (a Team Lead or an Admin) who is always a member
--   * members are the owner's direct reports or the owner; the service checks this when someone
--     is added, the table keeps the rows
--   * `version` is a compare-and-set token for edits
--   * nothing is deleted: a finished project is archived

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description VARCHAR(1000),
  owner_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  start_date DATE,
  end_date DATE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT projects_code_format CHECK (code ~ '^[A-Z][A-Z0-9_-]{1,19}$'),
  CONSTRAINT projects_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT projects_status_check CHECK (status IN ('active', 'archived')),
  CONSTRAINT projects_dates_check CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- Justification: the code is the stable handle people use; names may repeat across teams.
CREATE UNIQUE INDEX uq_projects_code ON projects (code);
-- Justification: FK index, and a Team Lead's "projects I own" list.
CREATE INDEX idx_projects_owner ON projects (owner_employee_id, status);

CREATE TABLE project_members (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, employee_id)
);

-- Justification: "the projects I belong to" is the read path of every member.
CREATE INDEX idx_project_members_employee ON project_members (employee_id);
