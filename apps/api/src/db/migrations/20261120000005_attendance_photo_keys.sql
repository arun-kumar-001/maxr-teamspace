-- Check-in and check-out selfies were stored inside attendance_records as base64 text (up to 600 KB
-- each, twice a day per employee). That bypassed the storage service (type check, virus scan, signed
-- links) and put every photo into every list response. They are now files in private storage and the
-- row keeps only the storage key.
--
-- check_in_photo / check_out_photo are kept for now: rows written before this change still hold their
-- photo there until `npm run db:move-attendance-photos` has copied it into storage. Drop them in a later
-- migration once that command has been run everywhere.
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS check_in_photo_key TEXT,
  ADD COLUMN IF NOT EXISTS check_out_photo_key TEXT;
