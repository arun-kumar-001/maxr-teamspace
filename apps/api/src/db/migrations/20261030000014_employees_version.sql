-- Optimistic concurrency for employee edits (#21): every update bumps `version` and `updated_at`,
-- in a trigger, so no code path (profile edit, deactivation, manager change, onboarding) can forget.
-- A client sends the version it read; an edit made on a stale version is refused with 409.
-- employees is a shared table: reviewed by the Technical Lead (AGENTS.md section 12).

ALTER TABLE employees ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION employees_bump_version() RETURNS trigger AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_bump_version ON employees;
CREATE TRIGGER trg_employees_bump_version
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION employees_bump_version();

ALTER TABLE employees
  ADD CONSTRAINT employees_version_positive CHECK (version >= 1);
