-- Update standard shifts to 09:00 - 19:00 (9 to 7) as requested
UPDATE shifts
SET start_time = '09:00', end_time = '19:00', name = 'Standard Shift (9 to 7)'
WHERE LOWER(code) IN ('standard', 'general');

INSERT INTO shifts (id, code, name, start_time, end_time, grace_minutes)
VALUES
  ('70000000-0000-4000-8000-000000000005', 'STANDARD', 'Standard Shift (9 to 7)', '09:00', '19:00', 15)
ON CONFLICT (LOWER(code)) DO UPDATE
SET start_time = '09:00', end_time = '19:00', name = 'Standard Shift (9 to 7)';
