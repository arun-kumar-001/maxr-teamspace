-- Align employee status with First Version specification (Active / Inactive / Resigned)
-- Preserves existing 'pending' and 'deactivated' values for backward compatibility.

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_status_check
  CHECK (status IN ('active', 'inactive', 'resigned', 'pending', 'deactivated'));

