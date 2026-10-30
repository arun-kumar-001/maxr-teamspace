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


-- 2-4. Roles, permissions and role mappings are reference data owned by migration
--      20261030000001_rbac_reference_data.sql (they exist in production too).


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
-- Development password for all four seeded users: Password123! (Argon2id, the production parameters; login is tested against it). Development only: the seeder refuses production.
-- Login (issue #7) checks this hash; its hashing library test also verifies the password.
INSERT INTO users (id, employee_id, email, password_hash, is_active) VALUES
  (
    '60000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000001',
    'admin@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000002',
    'hr@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'teamlead@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000004',
    '50000000-0000-0000-0000-000000000004',
    'staff@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  )
ON CONFLICT (employee_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash, -- re-seeding resets the development password
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 9. User Roles Mapping
INSERT INTO user_roles (user_id, role_id) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'), -- Admin -> admin
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'), -- HR -> hr_manager
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003'), -- Team Lead -> team_lead
  ('60000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000004')  -- Staff -> staff
ON CONFLICT (user_id, role_id) DO NOTHING;
