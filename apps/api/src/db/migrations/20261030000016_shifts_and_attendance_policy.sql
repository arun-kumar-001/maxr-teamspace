-- Shifts, date-effective shift assignments and the attendance policy (#33, decision D-13).
--
--   * shift times are company-local wall-clock times (the timezone is a company setting)
--   * a shift whose end is not after its start crosses midnight and belongs to the date it starts
--   * an employee has at most one shift on any date: enforced by the database, not only by code
--   * the policy is one row (full day and half day minutes, the shift used when nobody assigned one)

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_minutes SMALLINT NOT NULL DEFAULT 15 CHECK (grace_minutes BETWEEN 0 AND 240),
  crosses_midnight BOOLEAN GENERATED ALWAYS AS (end_time <= start_time) STORED,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shifts_start_differs_from_end CHECK (start_time <> end_time)
);

-- Unique shift code, compared without letter case (the business identifier).
CREATE UNIQUE INDEX IF NOT EXISTS idx_shifts_code_unique ON shifts (LOWER(code));
-- The list screen filters on active shifts.
CREATE INDEX IF NOT EXISTS idx_shifts_is_active ON shifts (is_active);

-- The default shift of decision D-13: General, 09:00 to 18:00, 15 minutes grace.
INSERT INTO shifts (id, code, name, start_time, end_time, grace_minutes)
VALUES ('70000000-0000-4000-8000-000000000001', 'GENERAL', 'General', '09:00', '18:00', 15)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  -- Inclusive; NULL means the assignment has no end date.
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT employee_shifts_range CHECK (effective_to IS NULL OR effective_to >= effective_from),
  -- No two assignments of one employee may cover the same date. The index behind this constraint
  -- also serves "which shift on this date" for an employee.
  CONSTRAINT employee_shifts_no_overlap EXCLUDE USING gist (
    employee_id WITH =,
    daterange(effective_from, effective_to, '[]') WITH &&
  )
);

-- Foreign key index: finding the assignments of a shift (in-use check before it is deactivated).
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_id ON employee_shifts (shift_id);

CREATE TABLE IF NOT EXISTS attendance_policies (
  id UUID PRIMARY KEY DEFAULT '70000000-0000-4000-8000-000000000002',
  full_day_minutes SMALLINT NOT NULL DEFAULT 480 CHECK (full_day_minutes BETWEEN 2 AND 1440),
  half_day_minutes SMALLINT NOT NULL DEFAULT 240 CHECK (half_day_minutes >= 1),
  default_shift_id UUID NOT NULL REFERENCES shifts(id) ON DELETE RESTRICT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_policies_singleton CHECK (id = '70000000-0000-4000-8000-000000000002'),
  CONSTRAINT attendance_policies_half_below_full CHECK (half_day_minutes < full_day_minutes)
);

-- Foreign key index: finding the policy that uses a shift as its default.
CREATE INDEX IF NOT EXISTS idx_attendance_policies_default_shift ON attendance_policies (default_shift_id);

-- Full day 8 hours, half day 4 hours (D-13). The row always exists, like company_settings.
INSERT INTO attendance_policies (id, full_day_minutes, half_day_minutes, default_shift_id)
VALUES ('70000000-0000-4000-8000-000000000002', 480, 240, '70000000-0000-4000-8000-000000000001')
ON CONFLICT (id) DO NOTHING;
