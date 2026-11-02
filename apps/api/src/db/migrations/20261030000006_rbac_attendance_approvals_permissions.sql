-- RBAC reference data for attendance listing, shifts, attendance policy and the approvals engine
-- (#33, #35, #37). Mirrors modules/rbac/permission-catalog.ts; rbac-reference-data.test.ts fails
-- when they differ. Idempotent.

INSERT INTO permissions (id, key, module, action, description) VALUES
  ('20000000-0000-0000-0000-000000000043', 'attendance.list', 'attendance', 'list', 'List attendance records within the role scope'),
  ('20000000-0000-0000-0000-000000000044', 'shifts.list', 'shifts', 'list', 'View shift definitions'),
  ('20000000-0000-0000-0000-000000000045', 'shifts.read_assignment', 'shifts', 'read_assignment', 'View the shifts assigned to an employee'),
  ('20000000-0000-0000-0000-000000000046', 'shifts.create', 'shifts', 'create', 'Create shift definitions'),
  ('20000000-0000-0000-0000-000000000047', 'shifts.update', 'shifts', 'update', 'Update shift definitions'),
  ('20000000-0000-0000-0000-000000000048', 'shifts.assign', 'shifts', 'assign', 'Assign shifts to employees'),
  ('20000000-0000-0000-0000-000000000049', 'attendance_policies.read', 'attendance_policies', 'read', 'View attendance policy'),
  ('20000000-0000-0000-0000-000000000050', 'attendance_policies.update', 'attendance_policies', 'update', 'Update attendance policy'),
  ('20000000-0000-0000-0000-000000000051', 'approvals.list', 'approvals', 'list', 'List approval requests within the role scope'),
  ('20000000-0000-0000-0000-000000000052', 'approvals.read', 'approvals', 'read', 'View an approval request'),
  ('20000000-0000-0000-0000-000000000053', 'approvals.create', 'approvals', 'create', 'Submit an approval request'),
  ('20000000-0000-0000-0000-000000000054', 'approvals.decide', 'approvals', 'decide', 'Approve or reject an approval request')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;

-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN (
  'attendance.list',
  'shifts.list', 'shifts.read_assignment', 'shifts.create', 'shifts.update', 'shifts.assign',
  'attendance_policies.read', 'attendance_policies.update',
  'approvals.list', 'approvals.read', 'approvals.create', 'approvals.decide'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN (
  'attendance.list',
  'shifts.list', 'shifts.read_assignment',
  'attendance_policies.read',
  'approvals.list', 'approvals.read', 'approvals.create', 'approvals.decide'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN (
  'shifts.list', 'shifts.read_assignment',
  'attendance_policies.read',
  'approvals.list', 'approvals.read', 'approvals.create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
