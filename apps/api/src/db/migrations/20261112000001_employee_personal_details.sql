-- Add extended personal, contact, and address fields for employee onboarding/registration.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS additional_emails TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS additional_phones TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS permanent_address TEXT,
  ADD COLUMN IF NOT EXISTS current_address TEXT,
  ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10),
  ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS aadhaar_number VARCHAR(20);

