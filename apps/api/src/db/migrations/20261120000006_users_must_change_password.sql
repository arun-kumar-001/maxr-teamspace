-- A password that someone else chose or generated (an Admin creating an account, a new employee's
-- account) must be replaced by its owner at the first sign-in. Existing accounts are not affected.
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;
