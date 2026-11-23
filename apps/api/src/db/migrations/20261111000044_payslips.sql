-- ==============================================================================
-- Migration: 20261111000044_payslips.sql
-- Employee Monthly Payslips Schema
-- ==============================================================================

CREATE TABLE IF NOT EXISTS payslips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  pay_month INTEGER NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
  pay_year INTEGER NOT NULL CHECK (pay_year BETWEEN 2000 AND 2100),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TIMESTAMPTZ,
  published_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_display_name TEXT NOT NULL DEFAULT '',
  emp_no TEXT NOT NULL DEFAULT '',
  designation TEXT NOT NULL DEFAULT '',
  uan TEXT NOT NULL DEFAULT '',
  pan TEXT NOT NULL DEFAULT '',
  bank_name TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  days_paid NUMERIC NOT NULL DEFAULT 30 CHECK (days_paid >= 0 AND days_paid <= 31),
  leave_sl NUMERIC NOT NULL DEFAULT 0,
  leave_el NUMERIC NOT NULL DEFAULT 0,
  leave_cl NUMERIC NOT NULL DEFAULT 0,
  leave_fl NUMERIC NOT NULL DEFAULT 0,
  leave_lc NUMERIC NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  base_branch TEXT NOT NULL DEFAULT '',
  work_location TEXT NOT NULL DEFAULT '',
  beneficiary_id TEXT NOT NULL DEFAULT '',
  basic_arrears_paise BIGINT NOT NULL DEFAULT 0,
  basic_current_paise BIGINT NOT NULL DEFAULT 0,
  hra_arrears_paise BIGINT NOT NULL DEFAULT 0,
  hra_current_paise BIGINT NOT NULL DEFAULT 0,
  performance_arrears_paise BIGINT NOT NULL DEFAULT 0,
  performance_current_paise BIGINT NOT NULL DEFAULT 0,
  variable_arrears_paise BIGINT NOT NULL DEFAULT 0,
  variable_current_paise BIGINT NOT NULL DEFAULT 0,
  pf_deduction_paise BIGINT NOT NULL DEFAULT 0,
  income_tax_paise BIGINT NOT NULL DEFAULT 0,
  professional_tax_paise BIGINT NOT NULL DEFAULT 0,
  other_deduction_label TEXT NOT NULL DEFAULT 'Desc.',
  other_deduction_paise BIGINT NOT NULL DEFAULT 0,
  retiral_pf_paise BIGINT NOT NULL DEFAULT 0,
  retiral_gratuity_paise BIGINT NOT NULL DEFAULT 0,
  annual_income_paise BIGINT NOT NULL DEFAULT 0,
  annual_deductions_paise BIGINT NOT NULL DEFAULT 0,
  net_taxable_income_paise BIGINT NOT NULL DEFAULT 0,
  total_tax_payable_paise BIGINT NOT NULL DEFAULT 0,
  tax_deducted_till_now_paise BIGINT NOT NULL DEFAULT 0,
  balance_tax_paise BIGINT NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payslips_unique_employee_period UNIQUE (employee_id, pay_year, pay_month)
);

-- Justification: fast chronological listing per employee
CREATE INDEX IF NOT EXISTS idx_payslips_employee_period
  ON payslips (employee_id, pay_year DESC, pay_month DESC);

-- Justification: fast filtering by publish status
CREATE INDEX IF NOT EXISTS idx_payslips_status
  ON payslips (status);
