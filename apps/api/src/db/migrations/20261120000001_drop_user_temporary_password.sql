-- Security: users.temporary_password held the account password in plain text and was returned by
-- the user list API. Only password_hash may be stored. A generated password is shown once, in the
-- response that creates the account, and is never kept.
--
-- Dropping the column also removes every plain-text password already stored. Admins who still hold
-- an account created with one should treat that password as exposed and change it.
ALTER TABLE users DROP COLUMN IF EXISTS temporary_password;
