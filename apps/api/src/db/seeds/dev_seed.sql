-- ==============================================================================
-- Development Seed Data (Safe for Local Development and Testing Only)
-- Guarded by Seeder: Refuses to execute when NODE_ENV === 'production'
-- ==============================================================================

-- 1. Company Settings Baseline
INSERT INTO company_settings (id, company_name, timezone, work_week_start, work_week_end)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MAXR Teamspace Local Dev',
  'UTC',
  'Monday',
  'Friday'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  timezone = EXCLUDED.timezone,
  updated_at = NOW();


-- 2. Canonical Roles (D-01)
INSERT INTO roles (id, key, name, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'admin', 'Super Admin / Founder', 'Full company-wide administrative control, security, configuration, and audit logs'),
  ('10000000-0000-0000-0000-000000000002', 'hr_manager', 'HR Manager', 'Workforce management, onboarding, leaves, and attendance policy administration'),
  ('10000000-0000-0000-0000-000000000003', 'team_lead', 'Team Lead', 'Team oversight, task delegation, and leave/attendance approvals'),
  ('10000000-0000-0000-0000-000000000004', 'staff', 'Staff / Employee', 'Individual self-service: check-in/out, leave requests, own tasks, and profile')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  updated_at = NOW();


-- 3. Foundational Permissions Catalog
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


-- 4. Role Permissions Mapping
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


-- 5. Sample Departments
INSERT INTO departments (id, name, code, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', 'Engineering', 'ENG', true),
  ('30000000-0000-0000-0000-000000000002', 'Human Resources', 'HR', true),
  ('30000000-0000-0000-0000-000000000003', 'Operations', 'OPS', true)
ON CONFLICT (LOWER(code)) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 6. Sample Designations
INSERT INTO designations (id, department_id, title, code, level, is_active) VALUES
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Engineering Director', 'ENG-DIR', 4, true),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Staff Engineer', 'STAFF-ENG', 3, true),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'HR Manager', 'HR-MGR', 3, true),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001', 'Software Engineer', 'SWE', 2, true)
ON CONFLICT (LOWER(code)) DO UPDATE SET
  title = EXCLUDED.title,
  level = EXCLUDED.level,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 7. Sample Employees (1 per canonical role hierarchy)
INSERT INTO employees (
  id, employee_code, first_name, last_name, email, phone,
  department_id, designation_id, manager_id, status, joining_date
) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    'EMP-0001',
    'Arun',
    'Kumar',
    'admin@maxr.internal',
    '+91-9876543210',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    NULL,
    'active',
    '2024-01-01'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'EMP-0002',
    'Priya',
    'Sharma',
    'hr@maxr.internal',
    '+91-9876543211',
    '30000000-0000-0000-0000-000000000002',
    '40000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000001',
    'active',
    '2024-02-01'
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'EMP-0003',
    'Rajesh',
    'Patel',
    'teamlead@maxr.internal',
    '+91-9876543212',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000001',
    'active',
    '2024-03-01'
  ),
  (
    '50000000-0000-0000-0000-000000000004',
    'EMP-0004',
    'Ananya',
    'Sen',
    'staff@maxr.internal',
    '+91-9876543213',
    '30000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000003',
    'active',
    '2024-04-01'
  )
ON CONFLICT (LOWER(employee_code)) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  email = EXCLUDED.email,
  department_id = EXCLUDED.department_id,
  designation_id = EXCLUDED.designation_id,
  manager_id = EXCLUDED.manager_id,
  status = EXCLUDED.status,
  updated_at = NOW();


-- 8. Sample Users (Linked 1:1 to Employees via users.employee_id)
-- Development password for all four seeded users: Password123! (bcrypt cost 12; verified). Development only: the seeder refuses production.
-- Login (issue #7) checks this hash; its hashing library test also verifies the password.
INSERT INTO users (id, employee_id, email, password_hash, is_active) VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'admin@maxr.internal',
    '$2b$12$96er1UTXX78f5iClAEWDjevzqY23k1WCI8VSYwRcHUJx7piozkqyK',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    'hr@maxr.internal',
    '$2b$12$96er1UTXX78f5iClAEWDjevzqY23k1WCI8VSYwRcHUJx7piozkqyK',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'teamlead@maxr.internal',
    '$2b$12$96er1UTXX78f5iClAEWDjevzqY23k1WCI8VSYwRcHUJx7piozkqyK',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000004',
    'staff@maxr.internal',
    '$2b$12$96er1UTXX78f5iClAEWDjevzqY23k1WCI8VSYwRcHUJx7piozkqyK',
    true
  )
ON CONFLICT (employee_id) DO UPDATE SET
  email = EXCLUDED.email,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 9. User Roles Mapping
INSERT INTO user_roles (user_id, role_id) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'), -- Admin -> admin
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'), -- HR -> hr_manager
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003'), -- Team Lead -> team_lead
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004')  -- Staff -> staff
ON CONFLICT (user_id, role_id) DO NOTHING;
