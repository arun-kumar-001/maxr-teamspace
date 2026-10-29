-- Migration: create shifts, employee shifts, and attendance policies
-- Issue #33 / D2-01 (Daily Ops - Shifts & Policies)

CREATE TABLE IF NOT EXISTS shifts (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_minutes INT NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shifts_code ON shifts(code);

CREATE TABLE IF NOT EXISTS employee_shifts (
  id UUID PRIMARY KEY,
  employee_id UUID NOT NULL,
  shift_id UUID NOT NULL REFERENCES shifts(id),
  effective_from DATE NOT NULL,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift ON employee_shifts(shift_id);

CREATE TABLE IF NOT EXISTS attendance_policies (
  id UUID PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  grace_period_minutes INT NOT NULL DEFAULT 15,
  half_day_threshold_minutes INT NOT NULL DEFAULT 240,
  full_day_threshold_minutes INT NOT NULL DEFAULT 480,
  timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_policies_default ON attendance_policies(is_default);
