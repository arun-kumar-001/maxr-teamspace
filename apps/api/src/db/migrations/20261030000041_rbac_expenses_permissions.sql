-- RBAC reference data for expense claims (#29, D-17).
-- Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-00000000007c', 'expenses.submit', 'expenses', 'submit', 'Submit expense claim with receipt'),
  ('20000000-0000-0000-0000-00000000007d', 'expenses.list', 'expenses', 'list', 'List expense claims within the role scope'),
  ('20000000-0000-0000-0000-00000000007e', 'expenses.read', 'expenses', 'read', 'View expense claim details and download receipt'),
  ('20000000-0000-0000-0000-00000000007f', 'expenses.cancel', 'expenses', 'cancel', 'Cancel own submitted expense claim'),
  ('20000000-0000-0000-0000-000000000080', 'expenses.reimburse', 'expenses', 'reimburse', 'Mark approved expense claim as reimbursed'),
  ('20000000-0000-0000-0000-000000000081', 'expenses.manage_categories', 'expenses', 'manage_categories', 'Create and update expense categories'),
  ('20000000-0000-0000-0000-000000000082', 'expenses.read_categories', 'expenses', 'read_categories', 'View active expense categories')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all expense permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
WHERE key IN (
  'expenses.submit',
  'expenses.list',
  'expenses.read',
  'expenses.cancel',
  'expenses.reimburse',
  'expenses.manage_categories',
  'expenses.read_categories'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager can submit, list, read, cancel, reimburse, and manage categories
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN (
  'expenses.submit',
  'expenses.list',
  'expenses.read',
  'expenses.cancel',
  'expenses.reimburse',
  'expenses.manage_categories',
  'expenses.read_categories'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead can submit, list (team/own), read (team/own), cancel (own), and read categories
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN (
  'expenses.submit',
  'expenses.list',
  'expenses.read',
  'expenses.cancel',
  'expenses.read_categories'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff can submit, list (own), read (own), cancel (own), and read categories
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN (
  'expenses.submit',
  'expenses.list',
  'expenses.read',
  'expenses.cancel',
  'expenses.read_categories'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

