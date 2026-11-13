ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS breaks JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS break_minutes INT NOT NULL DEFAULT 0 CHECK (break_minutes >= 0);

