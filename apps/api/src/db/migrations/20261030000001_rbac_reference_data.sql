-- RBAC reference data: the four fixed roles (D-01, D-21), the permission catalog and the
-- role -> permission mapping. This is production data, not a dev fixture, so it lives in a
-- migration. It mirrors modules/rbac/permission-catalog.ts, which decides authorization at
-- runtime; rbac-reference-data.test.ts fails when the two differ.
-- Ids are fixed so the dev seed and fixtures can refer to them.
-- Idempotent: safe to run on a database that was seeded with the same rows earlier.

-- 1. Canonical Roles (D-01)
INSERT INTO roles (id, key, name, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin', 'Super Admin / Founder', 'Full company-wide administrative control, security, configuration, and audit logs'),
  ('10000000-0000-0000-0000-000000000002', 'hr_manager', 'HR Manager', 'Workforce management, onboarding, leaves, and attendance policy administration'),
  ('10000000-0000-0000-0000-000000000003', 'team_lead', 'Team Lead', 'Team oversight, task delegation, and leave/attendance approvals'),
  ('10000000-0000-0000-0000-000000000004', 'staff', 'Staff / Employee', 'Individual self-service: check-in/out, leave requests, own tasks, and profile')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();


-- 2. Foundational Permissions Catalog
INSERT INTO permissions (id, key, module, action, description) VALUES
  -- Auth & Session
  ('20000000-0000-0000-0000-000000000001', 'auth.login', 'auth', 'login', 'Authenticate user credentials'),
  ('20000000-0000-0000-0000-000000000002', 'auth.logout', 'auth', 'logout', 'End active session'),
  -- Users & Roles
  ('20000000-0000-0000-0000-000000000003', 'users.create', 'users', 'create', 'Create user accounts'),
  ('20000000-0000-0000-0000-000000000004', 'users.list', 'users', 'list', 'List user accounts'),
  ('20000000-0000-0000-0000-000000000005', 'users.read', 'users', 'read', 'View user account details'),
  ('20000000-0000-0000-0000-000000000006', 'users.update', 'users', 'update', 'Update user account'),
  ('20000000-0000-0000-0000-000000000007', 'users.deactivate', 'users', 'deactivate', 'Deactivate user account and revoke sessions'),
  ('20000000-0000-0000-0000-000000000008', 'users.assign_role', 'users', 'assign_role', 'Assign roles to user accounts'),
  ('20000000-0000-0000-0000-000000000009', 'roles.list', 'roles', 'list', 'List system roles'),
  ('20000000-0000-0000-0000-000000000010', 'permissions.list', 'permissions', 'list', 'List system permissions'),
  -- Audit Logs
  ('20000000-0000-0000-0000-000000000011', 'audit_logs.list', 'audit_logs', 'list', 'View system activity audit trail'),
  -- Departments & Designations
  ('20000000-0000-0000-0000-000000000012', 'departments.list', 'departments', 'list', 'List organizational departments'),
  ('20000000-0000-0000-0000-000000000013', 'departments.create', 'departments', 'create', 'Create organizational department'),
  ('20000000-0000-0000-0000-000000000014', 'departments.update', 'departments', 'update', 'Update organizational department'),
  ('20000000-0000-0000-0000-000000000015', 'departments.deactivate', 'departments', 'deactivate', 'Deactivate organizational department'),
  ('20000000-0000-0000-0000-000000000016', 'designations.list', 'designations', 'list', 'List organizational designations'),
  ('20000000-0000-0000-0000-000000000017', 'designations.create', 'designations', 'create', 'Create organizational designation'),
  ('20000000-0000-0000-0000-000000000018', 'designations.update', 'designations', 'update', 'Update organizational designation'),
  ('20000000-0000-0000-0000-000000000019', 'designations.deactivate', 'designations', 'deactivate', 'Deactivate organizational designation'),
  -- Employees
  ('20000000-0000-0000-0000-000000000020', 'employees.create', 'employees', 'create', 'Create new employee profile'),
  ('20000000-0000-0000-0000-000000000021', 'employees.list', 'employees', 'list', 'List employee directory records'),
  ('20000000-0000-0000-0000-000000000022', 'employees.read', 'employees', 'read', 'View employee profile details'),
  ('20000000-0000-0000-0000-000000000023', 'employees.update', 'employees', 'update', 'Update employee profile'),
  ('20000000-0000-0000-0000-000000000024', 'employees.deactivate', 'employees', 'deactivate', 'Deactivate employee profile'),
  -- Attendance
  ('20000000-0000-0000-0000-000000000025', 'attendance.check_in', 'attendance', 'check_in', 'Check-in to work session'),
  ('20000000-0000-0000-0000-000000000026', 'attendance.check_out', 'attendance', 'check_out', 'Check-out of work session'),
  ('20000000-0000-0000-0000-000000000027', 'attendance.read_own', 'attendance', 'read_own', 'View own attendance history'),
  ('20000000-0000-0000-0000-000000000028', 'attendance.read_team', 'attendance', 'read_team', 'View team attendance history'),
  ('20000000-0000-0000-0000-000000000029', 'attendance.read_all', 'attendance', 'read_all', 'View company-wide attendance history'),
  ('20000000-0000-0000-0000-000000000030', 'attendance.approve_correction', 'attendance', 'approve_correction', 'Approve attendance correction request'),
  -- Leave
  ('20000000-0000-0000-0000-000000000031', 'leave.apply', 'leave', 'apply', 'Submit leave request'),
  ('20000000-0000-0000-0000-000000000032', 'leave.read_own', 'leave', 'read_own', 'View own leave requests and balance'),
  ('20000000-0000-0000-0000-000000000033', 'leave.read_team', 'leave', 'read_team', 'View team leave requests and calendar'),
  ('20000000-0000-0000-0000-000000000034', 'leave.read_all', 'leave', 'read_all', 'View company-wide leave records'),
  ('20000000-0000-0000-0000-000000000035', 'leave.approve', 'leave', 'approve', 'Approve or reject leave request'),
  ('20000000-0000-0000-0000-000000000036', 'leave.cancel', 'leave', 'cancel', 'Cancel submitted leave request'),
  -- Tasks
  ('20000000-0000-0000-0000-000000000037', 'tasks.create', 'tasks', 'create', 'Create and assign team task'),
  ('20000000-0000-0000-0000-000000000038', 'tasks.read_own', 'tasks', 'read_own', 'View own assigned tasks'),
  ('20000000-0000-0000-0000-000000000039', 'tasks.read_team', 'tasks', 'read_team', 'View team task board'),
  ('20000000-0000-0000-0000-000000000040', 'tasks.update_status', 'tasks', 'update_status', 'Update status of task')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;


-- 3. Role Permissions Mapping
-- Admin receives all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000001', id FROM permissions
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- HR Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000002', id FROM permissions
WHERE key IN (
  'auth.login', 'auth.logout',
  'users.read', 'users.list', 'users.assign_role',
  'departments.list', 'departments.create', 'departments.update',
  'designations.list', 'designations.create', 'designations.update',
  'employees.create', 'employees.list', 'employees.read', 'employees.update',
  'attendance.check_in', 'attendance.check_out', 'attendance.read_own', 'attendance.read_all', 'attendance.approve_correction',
  'leave.apply', 'leave.read_own', 'leave.read_all', 'leave.approve', 'leave.cancel',
  'tasks.read_own', 'tasks.update_status'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Team Lead permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000003', id FROM permissions
WHERE key IN (
  'auth.login', 'auth.logout',
  'departments.list', 'designations.list',
  'employees.list', 'employees.read',
  'attendance.check_in', 'attendance.check_out', 'attendance.read_own', 'attendance.read_team', 'attendance.approve_correction',
  'leave.apply', 'leave.read_own', 'leave.read_team', 'leave.approve', 'leave.cancel',
  'tasks.create', 'tasks.read_own', 'tasks.read_team', 'tasks.update_status'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Staff permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT '10000000-0000-0000-0000-000000000004', id FROM permissions
WHERE key IN (
  'auth.login', 'auth.logout',
  'departments.list', 'designations.list',
  'employees.read',
  'attendance.check_in', 'attendance.check_out', 'attendance.read_own',
  'leave.apply', 'leave.read_own', 'leave.cancel',
  'tasks.read_own', 'tasks.update_status'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;


