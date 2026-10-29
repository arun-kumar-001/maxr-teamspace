-- ==============================================================================
-- Migration: 20261029000001_foundation_schema.sql
-- Foundation Schema for MAXR Teamspace (TL-04 / Issue #6)
--
-- Tables created:
--   1. departments
--   2. designations
--   3. employees
--   4. users
--   5. roles
--   6. permissions
--   7. role_permissions
--   8. user_roles
--   9. audit_logs
--  10. notification_outbox
--  11. login_attempts
--
-- Conforms strictly to:
--   - AGENTS.md §6 (Database conventions, snake_case, timestamptz, index every FK)
--   - Technical Lead decisions on Issue #6 (G-03, G-04, G-16 foundation scope)
--   - users.employee_id is NOT NULL UNIQUE REFERENCES employees(id)
--   - Canonical roles: admin, hr_manager, team_lead, staff
--   - Excludes sessions table (belongs to Issue #7 / D-05)
--   - shared-services.md §4 column contracts for audit_logs and notification_outbox
-- ==============================================================================

-- 1. DEPARTMENTS
-- Core organizational departments (e.g. Engineering, HR, Operations)
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Case-insensitive unique code per department (justification: prevents duplicate department codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_departments_code_unique ON departments (LOWER(code));
-- Index on is_active (justification: accelerates directory filter WHERE is_active = true)
CREATE INDEX IF NOT EXISTS idx_departments_is_active ON departments (is_active);


-- 2. DESIGNATIONS
-- Job titles and seniority levels within departments
CREATE TABLE IF NOT EXISTS designations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  title VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  level INT NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key index (justification: joins between designations and departments)
CREATE INDEX IF NOT EXISTS idx_designations_department_id ON designations (department_id);
-- Case-insensitive unique code per designation (justification: prevents duplicate designation codes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_designations_code_unique ON designations (LOWER(code));
-- Index on is_active (justification: filter active designations)
CREATE INDEX IF NOT EXISTS idx_designations_is_active ON designations (is_active);


-- 3. EMPLOYEES
-- Master workforce records across all roles
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code VARCHAR(50) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
  designation_id UUID NOT NULL REFERENCES designations(id) ON DELETE RESTRICT,
  manager_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'deactivated')),
  joining_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique employee code (justification: primary business identifier, fast lookup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_code_unique ON employees (LOWER(employee_code));
-- Unique employee email (justification: prevents duplicate corporate identity)
CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_email_unique ON employees (LOWER(email));
-- Foreign key indexes (justification: accelerates relational joins and directory filters)
CREATE INDEX IF NOT EXISTS idx_employees_department_id ON employees (department_id);
CREATE INDEX IF NOT EXISTS idx_employees_designation_id ON employees (designation_id);
CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees (manager_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees (status);
-- Composite name index (justification: accelerates directory sorting and search by last name / first name)
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees (last_name, first_name);


-- 4. USERS
-- Authentication credentials linked 1:1 to employees
-- (G-04 confirmed by TL: users.employee_id is NOT NULL UNIQUE)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on email (justification: login credential lookup)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email));
-- employee_id is UNIQUE on the column itself (1:1 relationship; its index serves profile lookup)
-- Index on is_active (justification: quick account status check during authentication)
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users (is_active);


-- 5. ROLES
-- Canonical system roles: admin, hr_manager, team_lead, staff (D-01)
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique key index (justification: fast role lookup by programmatic key)
CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_key_unique ON roles (key);


-- 6. PERMISSIONS
-- Fine-grained system permissions (module.action)
CREATE TABLE IF NOT EXISTS permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique key index (justification: fast permission lookup by module.action)
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_key_unique ON permissions (key);
-- Module index (justification: group permissions by module for role administration)
CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions (module);


-- 7. ROLE_PERMISSIONS
-- Mapping between roles and permissions (many-to-many)
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Foreign key index on permission_id (justification: reverse lookup of roles carrying a permission)
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions (permission_id);


-- 8. USER_ROLES
-- Mapping between users and roles (many-to-many)
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

-- Foreign key index on role_id (justification: find all users with a specific role)
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles (role_id);


-- 9. AUDIT_LOGS
-- Immutable activity audit trail (shared-services.md §4.1)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  action TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('success', 'denied', 'failure')),
  actor_id UUID,
  actor_role TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  request_id TEXT,
  changes JSONB,
  metadata JSONB
);

-- Performance indexes for audit log queries per shared-services.md §4.1 contract
CREATE INDEX IF NOT EXISTS idx_audit_logs_occurred_at ON audit_logs (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_occurred_at ON audit_logs (actor_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_occurred_at ON audit_logs (entity_type, entity_id, occurred_at DESC);

-- Append-only enforcement: prevent UPDATE, DELETE, and TRUNCATE operations on audit_logs (shared-services.md §4.1)
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: UPDATE, DELETE, and TRUNCATE operations are strictly prohibited';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_no_update_delete ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_update_delete
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

DROP TRIGGER IF EXISTS trg_audit_logs_no_truncate ON audit_logs;
CREATE TRIGGER trg_audit_logs_no_truncate
BEFORE TRUNCATE ON audit_logs
FOR EACH STATEMENT EXECUTE FUNCTION prevent_audit_log_modification();

-- Revoke mutation privileges from PUBLIC
REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;


-- 10. NOTIFICATION_OUTBOX
-- Durable transactional message outbox (shared-services.md §4.3)
CREATE TABLE IF NOT EXISTS notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'email',
  payload JSONB NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'dead')),
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  last_error TEXT,
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

-- Unique index on dedupe_key (justification: prevent duplicate email enqueue)
CREATE UNIQUE INDEX IF NOT EXISTS idx_notification_outbox_dedupe_key ON notification_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;
-- Composite index for claimDue worker query (justification: fast retrieval of pending/overdue messages with SKIP LOCKED)
CREATE INDEX IF NOT EXISTS idx_notification_outbox_due ON notification_outbox (status, next_attempt_at, locked_until);


-- 11. LOGIN_ATTEMPTS
-- Rate-limiting and brute-force lockout tracking (G-16 / M1)
CREATE TABLE IF NOT EXISTS login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address VARCHAR(45) NOT NULL,
  identifier VARCHAR(255) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for brute-force rate limit lookups (justification: count recent failed attempts by username/IP within window)
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts (identifier, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts (ip_address, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_attempts_attempted_at ON login_attempts (attempted_at DESC);


-- 12. APPLICATION RUNTIME ROLE (Least-Privilege Separation)
-- Dedicated non-superuser role for application runtime connections.
-- In production, the role and its secret should be pre-provisioned by infrastructure/DBA.
-- Here we safely ensure the role exists without setting or overwriting any password in migration SQL.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maxr_app') THEN
    CREATE ROLE maxr_app WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
$$;

-- Grant schema access
GRANT USAGE ON SCHEMA public TO maxr_app;

-- Grant operational DML on existing application tables and sequences
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maxr_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO maxr_app;

-- Auto-grant operational DML on future tables and sequences created by this migration role
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO maxr_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO maxr_app;

-- Strictly enforce append-only permissions on audit_logs for maxr_app
REVOKE ALL ON audit_logs FROM maxr_app;
GRANT SELECT, INSERT ON audit_logs TO maxr_app;

-- Strictly enforce read-only permissions on schema_migrations for maxr_app
REVOKE ALL ON schema_migrations FROM maxr_app;
GRANT SELECT ON schema_migrations TO maxr_app;
