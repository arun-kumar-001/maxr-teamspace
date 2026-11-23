-- When an employee was deactivated, for the joiners/leavers report (#31) and offboarding history (#26).
--   * the column is set by a trigger, so every path that deactivates an employee records the
--     moment (the deactivation endpoint, an Admin script) and reactivation clears it
--   * existing deactivated rows get their last update time, the closest record there is
--   * a CHECK keeps the column and the status from disagreeing
-- employees is a shared table: reviewed by the Technical Lead (AGENTS.md section 12).

ALTER TABLE employees ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

UPDATE employees
   SET deactivated_at = updated_at
 WHERE status = 'deactivated' AND deactivated_at IS NULL;

CREATE OR REPLACE FUNCTION employees_set_deactivated_at() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'deactivated' THEN
    NEW.deactivated_at := COALESCE(NEW.deactivated_at, NOW());
  ELSE
    NEW.deactivated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_employees_deactivated_at ON employees;
CREATE TRIGGER trg_employees_deactivated_at
  BEFORE INSERT OR UPDATE OF status ON employees
  FOR EACH ROW EXECUTE FUNCTION employees_set_deactivated_at();

ALTER TABLE employees
  ADD CONSTRAINT employees_deactivated_at_matches_status
    CHECK ((status = 'deactivated') = (deactivated_at IS NOT NULL));

-- Joiners and leavers are listed by date range; both columns are filtered and sorted on.
CREATE INDEX IF NOT EXISTS idx_employees_joining_date ON employees (joining_date);
CREATE INDEX IF NOT EXISTS idx_employees_deactivated_at
  ON employees (deactivated_at) WHERE deactivated_at IS NOT NULL;
