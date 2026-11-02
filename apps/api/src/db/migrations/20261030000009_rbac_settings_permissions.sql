-- RBAC reference data for company settings (#30). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000055', 'settings.read', 'settings', 'read', 'View all company settings'),
  ('20000000-0000-0000-0000-000000000056', 'settings.read_basic', 'settings', 'read_basic', 'View company name, timezone and work week'),
  ('20000000-0000-0000-0000-000000000057', 'settings.update', 'settings', 'update', 'Change company settings')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('settings.read_basic')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('settings.read_basic')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('settings.read_basic')
ON CONFLICT (role_id, permission_id) DO NOTHING;
