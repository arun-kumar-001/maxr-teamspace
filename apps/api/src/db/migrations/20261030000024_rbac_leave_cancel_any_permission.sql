-- RBAC reference data for cancelling other people's leave (#40): HR Manager and Admin only.
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000062', 'leave.cancel_any', 'leave', 'cancel_any', 'Cancel an approved leave request of another employee')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('leave.cancel_any')
ON CONFLICT (role_id, permission_id) DO NOTHING;
