-- ==============================================================================
-- Attendance Module Migration (Issue #34, D2-02)
-- Creates attendance_records table and single open session partial unique index
-- ==============================================================================

CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status VARCHAR(50) NOT NULL DEFAULT 'PRESENT',
  location JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for searching attendance by employee and date
CREATE INDEX IF NOT EXISTS idx_attendance_records_employee_date 
  ON attendance_records (employee_id, work_date DESC);

-- Partial unique index strictly guaranteeing at most one open session per employee [SPEC & AGENTS.md §6]
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_single_open_session 
  ON attendance_records (employee_id) 
  WHERE check_out_time IS NULL;
