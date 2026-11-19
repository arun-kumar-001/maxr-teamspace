-- Dynamic Leave Policy Management & Ledger (#38, Dynamic Leave System)
-- Enables company-defined custom leave types, multi-policy profiles,
-- configurable accruals, carry forward rules, encashment, and ledger-based tracking.

-- 1. Extend leave_types with dynamic configuration fields
ALTER TABLE leave_types
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS is_paid BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS accrual_method VARCHAR(30) DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS annual_entitlement NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_credit NUMERIC(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_forward_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS carry_forward_max NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS carry_forward_expiry_months INT DEFAULT 12,
  ADD COLUMN IF NOT EXISTS encashment_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_encashable_days NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS encashment_basis VARCHAR(30) DEFAULT 'basic_salary',
  ADD COLUMN IF NOT EXISTS encashment_at_year_end BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS encashment_at_exit BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_half_day BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_negative_balance BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_negative_days NUMERIC(5,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS require_docs BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS min_days_for_docs NUMERIC(5,1) DEFAULT 2,
  ADD COLUMN IF NOT EXISTS notice_period_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_consecutive_days INT DEFAULT 30,
  ADD COLUMN IF NOT EXISTS allow_probation BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS max_backdate_days INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS include_weekends BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS include_holidays BOOLEAN DEFAULT FALSE;

-- 2. Leave Policy Profiles (e.g. General Staff, Tech Team, Executives)
CREATE TABLE IF NOT EXISTS leave_policy_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  leave_year_type VARCHAR(30) NOT NULL DEFAULT 'calendar',
  prorated_allocation BOOLEAN NOT NULL DEFAULT TRUE,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Policy-specific rule overrides per leave type
CREATE TABLE IF NOT EXISTS leave_policy_rule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES leave_policy_profiles(id) ON DELETE CASCADE,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE CASCADE,
  accrual_method VARCHAR(30) NOT NULL DEFAULT 'yearly',
  annual_allocation NUMERIC(5,1) NOT NULL DEFAULT 0,
  monthly_credit NUMERIC(5,2) NOT NULL DEFAULT 0,
  max_balance NUMERIC(5,1) NOT NULL DEFAULT 60,
  carry_forward_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  carry_forward_max NUMERIC(5,1) NOT NULL DEFAULT 0,
  carry_forward_expiry_months INT NOT NULL DEFAULT 12,
  encashment_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  max_encashable_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  encashment_basis VARCHAR(30) NOT NULL DEFAULT 'basic_salary',
  allow_half_day BOOLEAN NOT NULL DEFAULT TRUE,
  allow_negative_balance BOOLEAN NOT NULL DEFAULT FALSE,
  max_negative_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  require_docs BOOLEAN NOT NULL DEFAULT FALSE,
  min_days_for_docs NUMERIC(5,1) NOT NULL DEFAULT 2,
  notice_period_days INT NOT NULL DEFAULT 0,
  max_consecutive_days INT NOT NULL DEFAULT 30,
  allow_probation BOOLEAN NOT NULL DEFAULT TRUE,
  include_weekends BOOLEAN NOT NULL DEFAULT FALSE,
  include_holidays BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_policy_leave_type UNIQUE (policy_id, leave_type_id)
);

-- 4. Employee assignments to leave policies
CREATE TABLE IF NOT EXISTS employee_leave_policy_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES leave_policy_profiles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  department_id UUID,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_to DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emp_leave_policy_emp ON employee_leave_policy_assignments (employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_leave_policy_dept ON employee_leave_policy_assignments (department_id);

-- 5. Complete immutable leave ledger for audits and calculations
CREATE TABLE IF NOT EXISTS leave_ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  transaction_type VARCHAR(30) NOT NULL, -- 'credit', 'deduction', 'adjustment', 'carry_forward', 'encashment', 'expired'
  days NUMERIC(5,2) NOT NULL,
  balance_after NUMERIC(5,2) NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_ledger_emp_type ON leave_ledger_transactions (employee_id, leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_ledger_date ON leave_ledger_transactions (transaction_date);

-- 6. Leave Encashment records
CREATE TABLE IF NOT EXISTS leave_encashments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  days NUMERIC(5,1) NOT NULL,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'processed'
  encashment_reason VARCHAR(30) NOT NULL DEFAULT 'year_end', -- 'year_end', 'exit', 'adhoc'
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_encashments_emp ON leave_encashments (employee_id);

-- 7. Accrual execution history
CREATE TABLE IF NOT EXISTS leave_accrual_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  month INT,
  leave_type_id UUID REFERENCES leave_types(id) ON DELETE CASCADE,
  employees_credited INT NOT NULL DEFAULT 0,
  total_days_credited NUMERIC(10,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'success',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
