-- Aadhaar, PAN and bank account numbers are now stored encrypted (AES-256-GCM, see
-- security/field-crypto.ts). The encrypted form is longer than the 20 and 50 character limits that
-- fit the plain numbers, and the format is validated before encryption, so the length limit moves
-- out of the database. Existing plain values stay readable until `npm run db:encrypt-fields` runs.
ALTER TABLE employees
  ALTER COLUMN pan_number TYPE TEXT,
  ALTER COLUMN aadhaar_number TYPE TEXT,
  ALTER COLUMN bank_account_number TYPE TEXT;
