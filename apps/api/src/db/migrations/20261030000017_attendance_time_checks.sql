-- Attendance records can never end before they start or have a negative length (#34 follow-up).
-- The service computes both, but "constraints in the database, not just in code" (AGENTS.md section 6).

ALTER TABLE attendance_records
  ADD CONSTRAINT attendance_check_out_not_before_check_in
    CHECK (check_out_time IS NULL OR check_out_time >= check_in_time),
  ADD CONSTRAINT attendance_duration_not_negative
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0);
