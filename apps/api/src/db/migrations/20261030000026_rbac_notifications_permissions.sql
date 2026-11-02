-- RBAC reference data for notifications (#41). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000063', 'notifications.read_own', 'notifications', 'read_own', 'Read and mark own notifications'),
  ('20000000-0000-0000-0000-000000000064', 'notifications.announce', 'notifications', 'announce', 'Send an announcement to every employee')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('notifications.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('notifications.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('notifications.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;
