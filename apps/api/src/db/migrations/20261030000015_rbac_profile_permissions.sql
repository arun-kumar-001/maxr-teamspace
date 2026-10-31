-- RBAC reference data for the caller's own profile (#22). Mirrors modules/rbac/permission-catalog.ts;
-- rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000058', 'profile.read', 'profile', 'read', 'View own profile'),
  ('20000000-0000-0000-0000-000000000059', 'profile.update', 'profile', 'update', 'Update own profile (allowed fields only)')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('profile.read', 'profile.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('profile.read', 'profile.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('profile.read', 'profile.update')
ON CONFLICT (role_id, permission_id) DO NOTHING;
