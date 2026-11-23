-- RBAC reference data: grant Staff ability to create own tasks (#54).
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('tasks.create')
ON CONFLICT (role_id, permission_id) DO NOTHING;
