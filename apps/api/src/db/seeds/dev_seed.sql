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


-- 5. Departments
INSERT INTO departments (id, name, code, is_active) VALUES
  ('30000000-0000-0000-0000-000000000001', 'HR Department', 'HR', true),
  ('30000000-0000-0000-0000-000000000002', 'Sales Department', 'SALES', true),
  ('30000000-0000-0000-0000-000000000003', 'Digital Marketing Department', 'MKTG', true),
  ('30000000-0000-0000-0000-000000000004', 'AI Department', 'AI', true),
  ('30000000-0000-0000-0000-000000000005', 'Research Analyst Department', 'RA', true)
ON CONFLICT (LOWER(code)) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 6. Designations
INSERT INTO designations (id, department_id, title, code, level, is_active) VALUES
  ('40000000-0000-0000-0000-000000000001', (SELECT id FROM departments WHERE LOWER(code) = 'hr'), 'System Administrator', 'SYS-ADMIN', 4, true),
  ('40000000-0000-0000-0000-000000000002', (SELECT id FROM departments WHERE LOWER(code) = 'ai'), 'AI Intern', 'AI-INTERN', 1, true),
  ('40000000-0000-0000-0000-000000000003', (SELECT id FROM departments WHERE LOWER(code) = 'hr'), 'HR Manager', 'HR-MGR', 3, true)
ON CONFLICT (LOWER(code)) DO UPDATE SET
  title = EXCLUDED.title,
  level = EXCLUDED.level,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 7. Employees
INSERT INTO employees (
  id, employee_code, first_name, last_name, email, phone,
  department_id, designation_id, manager_id, status, joining_date
) VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    'EMP-0001',
    'Admin',
    '',
    'admin@maxr.internal',
    NULL,
    (SELECT id FROM departments WHERE LOWER(code) = 'hr'),
    (SELECT id FROM designations WHERE LOWER(code) = 'sys-admin'),
    NULL,
    'active',
    '2024-01-01'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'EMP-0002',
    'Arunkumar',
    '',
    'arunkumar@maxr.internal',
    NULL,
    (SELECT id FROM departments WHERE LOWER(code) = 'ai'),
    (SELECT id FROM designations WHERE LOWER(code) = 'ai-intern'),
    '50000000-0000-0000-0000-000000000001',
    'active',
    CURRENT_DATE
  ),
  (
    '50000000-0000-0000-0000-000000000003',
    'EMP-0003',
    'Shajitha',
    '',
    'shajitha@maxr.internal',
    NULL,
    (SELECT id FROM departments WHERE LOWER(code) = 'hr'),
    (SELECT id FROM designations WHERE LOWER(code) = 'hr-mgr'),
    '50000000-0000-0000-0000-000000000001',
    'active',
    CURRENT_DATE
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


-- 8. Users (Linked 1:1 to Employee via users.employee_id)
-- Development password: Password123! (Argon2id, the production parameters). Development only.
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
    'arunkumar@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  ),
  (
    '60000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'shajitha@maxr.internal',
    '$argon2id$v=19$m=65536,t=3,p=1$IUgwrqWvQGd2k+5O4xHReg$Gd838liTG4elh5hCpCM/Zxft1mJhgiVp3cJelTTEhVI',
    true
  )
ON CONFLICT (employee_id) DO UPDATE SET
  email = EXCLUDED.email,
  password_hash = EXCLUDED.password_hash,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();


-- 9. User Roles Mapping
INSERT INTO user_roles (user_id, role_id) VALUES
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'), -- Admin -> admin
  ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004'), -- Arunkumar -> staff
  ('60000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002')  -- Shajitha -> hr_manager
ON CONFLICT (user_id, role_id) DO NOTHING;

