-- ==============================================================================
-- Migration: 20261030000007_attendance_records.sql
-- Attendance Records Table & Constraints (Issue #34)
--
-- Conforms strictly to:
--   - AGENTS.md §6 (Database conventions, snake_case, timestamptz, index every FK)
--   - AGENTS.md §6 & §9: At most one open attendance session per employee
--   - Technical Lead review: partial unique index, FK index, history filter index
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  duration_minutes INT,
  status VARCHAR(50) NOT NULL DEFAULT 'PRESENT' CHECK (status IN ('PRESENT', 'ABSENT', 'HALF_DAY', 'LATE', 'ON_LEAVE', 'HOLIDAY', 'WEEKEND')),
  location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key index (justification: accelerates relational joins to employees table and employee-scoped queries)
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_id ON attendance_records (employee_id);

-- Partial unique index (justification: guarantees at most one open attendance session per employee per AGENTS.md §6)
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_single_open_session ON attendance_records (employee_id) WHERE check_out_time IS NULL;

-- Composite history index (justification: accelerates employee attendance history queries filtered by employee_id and date range, sorted chronologically)
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date ON attendance_records (employee_id, work_date DESC, check_in_time DESC);

-- Date index (justification: accelerates daily company-wide and department-wide attendance reporting and aggregation)
CREATE INDEX IF NOT EXISTS idx_attendance_records_work_date ON attendance_records (work_date);

