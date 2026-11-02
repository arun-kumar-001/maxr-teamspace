-- RBAC reference data for onboarding (#24, D-20).
-- Mirrors modules/rbac/permission-catalog.ts; tests fail when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000070', 'onboarding.list', 'onboarding', 'list', 'View onboarding pipelines and board status'),
  ('20000000-0000-0000-0000-000000000071', 'onboarding.read', 'onboarding', 'read', 'View onboarding checklist details for an employee'),
  ('20000000-0000-0000-0000-000000000072', 'onboarding.read_own', 'onboarding', 'read_own', 'View own onboarding checklist'),
  ('20000000-0000-0000-0000-000000000073', 'onboarding.verify_hr', 'onboarding', 'verify_hr', 'Verify HR documents and employee details'),
  ('20000000-0000-0000-0000-000000000074', 'onboarding.verify_it', 'onboarding', 'verify_it', 'Verify work email and IT equipment provisioning'),
  ('20000000-0000-0000-0000-000000000075', 'onboarding.complete_employee', 'onboarding', 'complete_employee', 'Complete employee profile and policy acknowledgment step'),
  ('20000000-0000-0000-0000-000000000076', 'onboarding.activate', 'onboarding', 'activate', 'Activate employee account once all checklist items are verified'),
  ('20000000-0000-0000-0000-000000000077', 'onboarding.reopen', 'onboarding', 'reopen', 'Reopen an onboarding step and return account to pending')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
WHERE module = 'onboarding'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager: manages HR step, views pipeline, activates and reopens onboarding
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN (
  'onboarding.list',
  'onboarding.read',
  'onboarding.read_own',
  'onboarding.verify_hr',
  'onboarding.complete_employee',
  'onboarding.activate',
  'onboarding.reopen'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead: views onboarding progress for their team members
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN (
  'onboarding.list',
  'onboarding.read',
  'onboarding.read_own'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff: views own onboarding checklist and completes employee step
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN (
  'onboarding.read_own',
  'onboarding.complete_employee'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

