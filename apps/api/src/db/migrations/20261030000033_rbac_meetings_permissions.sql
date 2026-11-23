-- RBAC reference data for meetings (#45). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000068', 'meetings.schedule', 'meetings', 'schedule', 'Schedule, edit and cancel meetings you organise'),
  ('20000000-0000-0000-0000-000000000069', 'meetings.read_own', 'meetings', 'read_own', 'See the meetings you organise or are invited to'),
  ('20000000-0000-0000-0000-00000000006a', 'meetings.rsvp', 'meetings', 'rsvp', 'Answer an invitation to a meeting')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager and Team Lead schedule; everyone is invited and reads their own
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('meetings.schedule', 'meetings.read_own', 'meetings.rsvp')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('meetings.schedule', 'meetings.read_own', 'meetings.rsvp')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff are invited but do not schedule (D-18)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('meetings.read_own', 'meetings.rsvp')
ON CONFLICT (role_id, permission_id) DO NOTHING;
