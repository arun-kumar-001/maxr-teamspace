-- A profile photo is a private file in storage (type check, size limit, virus scan); the employee
-- row keeps its key and when it last changed. The timestamp becomes the `?v=` of the photo URL, so a
-- browser may cache a photo for a day and still see a new one the moment it is replaced.
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS profile_photo_key TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_updated_at TIMESTAMPTZ;
