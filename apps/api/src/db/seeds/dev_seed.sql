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


-- 10. Sample Projects, Assignments, Milestones & Updates (Development Only)
INSERT INTO projects (
  id, code, name, description, owner_employee_id, status,
  start_date, end_date, priority, workflow_status, progress_percent,
  objectives, scope, technologies
) VALUES
  (
    '70000000-0000-0000-0000-000000000001',
    'MAXR-PORTAL',
    'MAXR Employee Portal V2',
    'Modernize self-service attendance, leave workflows, and staff analytics with responsive glassmorphic views.',
    '50000000-0000-0000-0000-000000000003', -- Rajesh Patel (Team Lead)
    'active',
    '2026-09-01',
    '2026-12-15',
    'high',
    'in_progress',
    68,
    'Deliver unified employee workspace covering attendance tracking, dynamic leave applications, and real-time project visibility.',
    'Frontend React 18 modules, REST endpoints under /api/v1, and PostgreSQL schema migrations.',
    '["React 18", "TypeScript", "Node.js", "PostgreSQL 16", "Tailwind CSS"]'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000002',
    'OPS-AUTOMATION',
    'Shift & Attendance Sync Pipeline',
    'Automate shift roster imports, biometric punch reconciliation, and late-arrival exception alerts.',
    '50000000-0000-0000-0000-000000000003',
    'active',
    '2026-09-15',
    '2026-11-30',
    'medium',
    'in_progress',
    52,
    'Eliminate manual attendance reconciliation across engineering squads and surface actionable team summaries.',
    'Attendance rule engine, CSV export jobs, and shift policy enforcement.',
    '["TypeScript", "Express", "PostgreSQL 16", "Redis"]'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000003',
    'SEC-SSO-ROLLOUT',
    'Unified Session & Audit Hardening',
    'Security baseline hardening for HTTP-only session cookies, CSRF validation, and RBAC audit trails.',
    '50000000-0000-0000-0000-000000000003',
    'active',
    '2026-07-01',
    '2026-09-30',
    'high',
    'completed',
    100,
    'Achieve zero bypasses on record-scoped routes and immutable audit trail coverage for sensitive actions.',
    'Auth session lifecycle, Argon2id password policy, and role-permission matrix enforcement.',
    '["Argon2id", "Node.js", "PostgreSQL 16", "Vitest"]'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000004',
    'CLOUD-PERF-26',
    'Q4 Observability & Caching Upgrade',
    'Introduce Redis query caching for non-authoritative read dashboards and latency instrumentation.',
    '50000000-0000-0000-0000-000000000003',
    'active',
    '2026-12-01',
    '2027-02-15',
    'low',
    'not_started',
    10,
    'Keep p95 dashboard load latency under 180ms during peak check-in windows.',
    'Read-through Redis cache layer and OpenTelemetry trace spans.',
    '["Redis", "Docker", "Nginx", "TypeScript"]'::jsonb
  ),
  (
    '70000000-0000-0000-0000-000000000005',
    'EXEC-BOARD-PACK',
    'Confidential Executive Finance Pack',
    'Admin-only board reporting workspace (not assigned to general staff).',
    '50000000-0000-0000-0000-000000000001', -- Arun Kumar (Admin)
    'active',
    '2026-10-01',
    '2026-12-31',
    'high',
    'on_hold',
    35,
    'Restricted leadership consolidation workspace.',
    'Internal executive metrics.',
    '["PostgreSQL 16", "React 18"]'::jsonb
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (project_id, employee_id) VALUES
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000003'),
  ('70000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000004'),
  ('70000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO project_milestones (
  id, project_id, title, description, start_date, due_date, status, completion_percent, sort_order
) VALUES
  (
    '71000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'API Contract & Schema Freeze',
    'Finalize REST schemas, RBAC scope checks, and PostgreSQL migrations.',
    '2026-09-01',
    '2026-09-25',
    'completed',
    100,
    1
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    'Employee Dashboard & Leave Experience',
    'Ship responsive overview widgets, attendance timer, and dynamic leave policy selector.',
    '2026-09-26',
    '2026-11-15',
    'in_progress',
    75,
    2
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000001',
    'QA Sign-Off & Production Cutover',
    'End-to-end Playwright verification across phone, tablet, and desktop viewports.',
    '2026-11-16',
    '2026-12-15',
    'not_started',
    15,
    3
  ),
  (
    '71000000-0000-0000-0000-000000000004',
    '70000000-0000-0000-0000-000000000002',
    'Shift Schedule Rule Engine',
    'Implement grace window calculations and weekend holiday exclusions.',
    '2026-09-15',
    '2026-10-20',
    'completed',
    100,
    1
  ),
  (
    '71000000-0000-0000-0000-000000000005',
    '70000000-0000-0000-0000-000000000002',
    'Exception Alerts & Export',
    'Deliver late arrival notifications and payroll CSV summary export.',
    '2026-10-21',
    '2026-11-30',
    'in_progress',
    40,
    2
  ),
  (
    '71000000-0000-0000-0000-000000000006',
    '70000000-0000-0000-0000-000000000003',
    'Session Cookie & CSRF Enforcement',
    'Enforce HttpOnly SameSite cookies and CSRF double-submit verification.',
    '2026-07-01',
    '2026-09-30',
    'completed',
    100,
    1
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_updates (
  id, project_id, author_employee_id, update_type, content, progress_percent
) VALUES
  (
    '72000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    'manager_update',
    'Sprint review completed. Focus this week is finalizing employee project workspaces and milestone progress tracking.',
    68
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    '70000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000004',
    'progress_update',
    'Completed integration of responsive overview KPIs and milestone timeline components.',
    68
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    '70000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000003',
    'manager_update',
    'Shift rule engine passed staging checks. Next milestone: CSV payroll export verification.',
    52
  ),
  (
    '72000000-0000-0000-0000-000000000004',
    '70000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000003',
    'manager_update',
    'Project signed off and deployed with zero regression issues.',
    100
  )
ON CONFLICT (id) DO NOTHING;


-- 11. Sample Monthly Payslips (Development Only, Read-Only Published & Draft Examples)
INSERT INTO payslips (
  id, employee_id, pay_month, pay_year, status, published_at, published_by_employee_id,
  employee_display_name, emp_no, designation, uan, pan, bank_name, account_number, days_paid,
  leave_sl, leave_el, leave_cl, leave_fl, leave_lc,
  location, base_branch, work_location, beneficiary_id,
  basic_arrears_paise, basic_current_paise, hra_arrears_paise, hra_current_paise,
  performance_arrears_paise, performance_current_paise, variable_arrears_paise, variable_current_paise,
  pf_deduction_paise, income_tax_paise, professional_tax_paise, other_deduction_label, other_deduction_paise,
  retiral_pf_paise, retiral_gratuity_paise,
  annual_income_paise, annual_deductions_paise, net_taxable_income_paise,
  total_tax_payable_paise, tax_deducted_till_now_paise, balance_tax_paise
) VALUES
  (
    '81000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000004',
    10, 2026, 'published', '2026-10-31T12:00:00Z', '50000000-0000-0000-0000-000000000002',
    'Ms Ananya Sen', 'EMP-0004', 'Software Engineer', '101458290341', 'BNZPS4821K', 'HDFC Bank Ltd.', '50100482917304', 31,
    2, 11, 3, 1, 0,
    'Chennai', 'Chennai', 'Chennai', 'BEN0048219',
    0, 4800000, 0, 2100000, 0, 950000, 0, 1250000,
    360000, 220000, 20000, 'Desc.', 0,
    360000, 230800,
    109200000, 15000000, 94200000, 4680000, 1540000, 3140000
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    '50000000-0000-0000-0000-000000000004',
    9, 2026, 'published', '2026-09-30T12:00:00Z', '50000000-0000-0000-0000-000000000002',
    'Ms Ananya Sen', 'EMP-0004', 'Software Engineer', '101458290341', 'BNZPS4821K', 'HDFC Bank Ltd.', '50100482917304', 30,
    2, 10, 3, 1, 0,
    'Chennai', 'Chennai', 'Chennai', 'BEN0048219',
    0, 4800000, 0, 2100000, 0, 950000, 0, 1250000,
    360000, 220000, 20000, 'Desc.', 0,
    360000, 230800,
    109200000, 15000000, 94200000, 4680000, 1320000, 3360000
  ),
  (
    '81000000-0000-0000-0000-000000000003',
    '50000000-0000-0000-0000-000000000004',
    8, 2026, 'published', '2026-08-31T12:00:00Z', '50000000-0000-0000-0000-000000000002',
    'Ms Ananya Sen', 'EMP-0004', 'Software Engineer', '101458290341', 'BNZPS4821K', 'HDFC Bank Ltd.', '50100482917304', 31,
    3, 9, 3, 1, 0,
    'Chennai', 'Chennai', 'Chennai', 'BEN0048219',
    150000, 4800000, 0, 2100000, 0, 800000, 0, 1250000,
    360000, 220000, 20000, 'Desc.', 0,
    360000, 230800,
    109200000, 15000000, 94200000, 4680000, 1100000, 3580000
  )
ON CONFLICT (id) DO NOTHING;
