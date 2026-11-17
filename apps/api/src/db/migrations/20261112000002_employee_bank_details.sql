-- Add optional bank account detail columns for employee payroll & banking records.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150),
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50),
  ADD COLUMN IF NOT EXISTS bank_ifsc_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(150);

