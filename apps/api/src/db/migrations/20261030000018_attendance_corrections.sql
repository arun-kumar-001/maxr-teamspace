-- Attendance correction requests (#36, decision D-13).
--
-- An employee asks to change the check-in and check-out of one of their own attendance records.
-- The decision goes through the approvals engine (subject type 'attendance_correction'); approval
-- overwrites the record's times in the same transaction as the decision.
--
--   * at most one open (pending) correction per record: a partial unique index, not only code
--   * the requested times are in order, and the original times are kept for the audit trail
--   * the 30-day window and the "not in the future" rule depend on the company clock, so the
--     service enforces them

CREATE TABLE attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_record_id UUID NOT NULL REFERENCES attendance_records(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  original_check_in TIMESTAMPTZ NOT NULL,
  original_check_out TIMESTAMPTZ,
  requested_check_in TIMESTAMPTZ NOT NULL,
  requested_check_out TIMESTAMPTZ NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_corrections_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  CONSTRAINT attendance_corrections_times_check
    CHECK (requested_check_out > requested_check_in),
  CONSTRAINT attendance_corrections_reason_check
    CHECK (char_length(btrim(reason)) > 0)
);

-- Justification: enforces "one open correction per record" even for two simultaneous requests.
CREATE UNIQUE INDEX idx_attendance_corrections_one_pending
  ON attendance_corrections (attendance_record_id) WHERE status = 'pending';

-- Justification: FK index, and the requester's own list (newest first).
CREATE INDEX idx_attendance_corrections_employee
  ON attendance_corrections (employee_id, created_at DESC);

-- Justification: FK index for the join from attendance records.
CREATE INDEX idx_attendance_corrections_record
  ON attendance_corrections (attendance_record_id);
