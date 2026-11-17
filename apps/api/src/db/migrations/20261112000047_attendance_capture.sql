ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_out_location JSONB,
  ADD COLUMN IF NOT EXISTS check_in_photo TEXT,
  ADD COLUMN IF NOT EXISTS check_out_photo TEXT;

