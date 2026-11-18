-- Adds temporary_password column to users table so administrators can view the initial
-- credentials provisioned during employee onboarding or user creation.
ALTER TABLE users ADD COLUMN IF NOT EXISTS temporary_password VARCHAR(255);
