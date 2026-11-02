-- RBAC reference data for expense claims (#29, decision D-17). Mirrors
-- modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-00000000006b', 'expenses.submit', 'expenses', 'submit', 'Create, submit and cancel your own expense claims and attach receipts'),
  ('20000000-0000-0000-0000-00000000006c', 'expenses.read_own', 'expenses', 'read_own', 'See your own expense claims and receipts'),
  ('20000000-0000-0000-0000-00000000006d', 'expenses.list', 'expenses', 'list', 'List and view the expense claims you review, within the role scope'),
  ('20000000-0000-0000-0000-00000000006e', 'expenses.reimburse', 'expenses', 'reimburse', 'Mark approved expense claims as reimbursed'),
  ('20000000-0000-0000-0000-00000000006f', 'expenses.manage_categories', 'expenses', 'manage_categories', 'Add and deactivate expense categories')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager reviews company-wide, reimburses and manages categories
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN ('expenses.submit', 'expenses.read_own', 'expenses.list', 'expenses.reimburse', 'expenses.manage_categories')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead reviews the team's claims (first step of D-17)
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN ('expenses.submit', 'expenses.read_own', 'expenses.list')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff submit and read their own claims
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN ('expenses.submit', 'expenses.read_own')
ON CONFLICT (role_id, permission_id) DO NOTHING;
