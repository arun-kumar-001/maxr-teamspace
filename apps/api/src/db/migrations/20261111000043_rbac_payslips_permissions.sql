-- RBAC reference data for employee payslips.
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000083', 'payslips.read_own', 'payslips', 'read_own', 'View and download own published payslips'),
  ('20000000-0000-0000-0000-000000000084', 'payslips.read_all', 'payslips', 'read_all', 'View and download employee payslips across the company'),
  ('20000000-0000-0000-0000-000000000085', 'payslips.manage', 'payslips', 'manage', 'Create, update, and publish employee payslips')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
WHERE key IN ('payslips.read_own', 'payslips.read_all', 'payslips.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('payslips.read_own', 'payslips.read_all', 'payslips.manage')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('payslips.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('payslips.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;
