-- Seed Standard Day and Night shifts for MAXR CRM Attendance Roster
INSERT INTO shifts (id, code, name, start_time, end_time, grace_minutes)
VALUES
  ('70000000-0000-4000-8000-000000000003', 'DAY', 'Day Shift', '06:00', '14:00', 15),
  ('70000000-0000-4000-8000-000000000004', 'NIGHT', 'Night Shift', '14:00', '22:00', 15)
ON CONFLICT (LOWER(code)) DO NOTHING;

