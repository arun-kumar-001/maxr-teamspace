-- RBAC reference data for leave policies, holidays and leave balances (#38). Mirrors
-- modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-00000000005b', 'leave_policies.read', 'leave_policies', 'read', 'View leave types and policies'),
  ('20000000-0000-0000-0000-00000000005c', 'leave_policies.manage', 'leave_policies', 'manage', 'Create and update leave types and policies'),
  ('20000000-0000-0000-0000-00000000005d', 'holidays.read', 'holidays', 'read', 'View the holiday calendar'),
  ('20000000-0000-0000-0000-00000000005e', 'holidays.manage', 'holidays', 'manage', 'Add and remove holidays'),
  ('20000000-0000-0000-0000-00000000005f', 'leave_balances.list', 'leave_balances', 'list', 'List leave balances within the role scope'),
  ('20000000-0000-0000-0000-000000000060', 'leave_balances.accrue', 'leave_balances', 'accrue', 'Create the yearly leave balances')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('leave_policies.read', 'leave_policies.manage', 'holidays.read', 'holidays.manage', 'leave_balances.list', 'leave_balances.accrue')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('leave_policies.read', 'holidays.read', 'leave_balances.list')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('leave_policies.read', 'holidays.read')
ON CONFLICT (role_id, permission_id) DO NOTHING;
