-- Seniority levels are no longer part of the designation contract.
-- Employee/designation foreign keys and reporting-manager links are preserved.
ALTER TABLE designations DROP COLUMN level;
