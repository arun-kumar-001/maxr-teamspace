-- RBAC reference data for personal to-do list (Module 6).
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000083', 'todos.manage', 'todos', 'manage', 'Manage personal to-do list')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
WHERE key IN ('todos.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager manages own to-dos
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('todos.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead manages own to-dos
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('todos.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff manages own to-dos
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('todos.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

