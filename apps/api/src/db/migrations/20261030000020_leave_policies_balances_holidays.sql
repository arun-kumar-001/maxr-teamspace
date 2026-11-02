-- Leave types, their policies, yearly balances and the holiday calendar (#38, decision D-12).
--
--   * a type is identity (code, name, whether it has a balance); its numbers live in a policy row
--   * all day amounts are in half-day steps (0.5), enforced by CHECKs
--   * a balance can never go negative: used <= allotted + carried_forward is a CHECK, so the
--     approval transaction (#40) cannot over-spend even if a code path forgets to look
--   * one balance row per employee, leave type and year (UNIQUE); the yearly accrual relies on it
--     to be safe to run twice
--   * seeded types and policies use fixed ids so tests and later migrations can refer to them

CREATE TABLE leave_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL,
  name VARCHAR(100) NOT NULL,
  has_balance BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_types_code_format CHECK (code ~ '^[A-Z][A-Z0-9_]*$'),
  CONSTRAINT leave_types_name_not_blank CHECK (char_length(btrim(name)) > 0)
);

-- Justification: the code is the stable handle in policies and reports; names must not repeat either.
CREATE UNIQUE INDEX uq_leave_types_code ON leave_types (code);
CREATE UNIQUE INDEX uq_leave_types_name ON leave_types (lower(name));

CREATE TABLE leave_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_type_id UUID NOT NULL UNIQUE REFERENCES leave_types(id) ON DELETE RESTRICT,
  annual_days NUMERIC(5,1) NOT NULL DEFAULT 0,
  carry_forward_max NUMERIC(5,1) NOT NULL DEFAULT 0,
  allow_half_day BOOLEAN NOT NULL DEFAULT TRUE,
  max_backdate_days INT NOT NULL DEFAULT 0,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_policies_annual_days_check
    CHECK (annual_days >= 0 AND annual_days <= 366 AND annual_days * 2 = trunc(annual_days * 2)),
  CONSTRAINT leave_policies_carry_forward_check
    CHECK (carry_forward_max >= 0 AND carry_forward_max <= 366 AND carry_forward_max * 2 = trunc(carry_forward_max * 2)),
  CONSTRAINT leave_policies_backdate_check CHECK (max_backdate_days BETWEEN 0 AND 30)
);

CREATE TABLE leave_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  leave_type_id UUID NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
  year INT NOT NULL,
  allotted NUMERIC(5,1) NOT NULL,
  carried_forward NUMERIC(5,1) NOT NULL DEFAULT 0,
  used NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT leave_balances_year_check CHECK (year BETWEEN 2000 AND 2100),
  CONSTRAINT leave_balances_amounts_check
    CHECK (allotted >= 0 AND carried_forward >= 0 AND used >= 0
           AND allotted * 2 = trunc(allotted * 2)
           AND carried_forward * 2 = trunc(carried_forward * 2)
           AND used * 2 = trunc(used * 2)),
  CONSTRAINT leave_balances_never_negative CHECK (used <= allotted + carried_forward),
  CONSTRAINT leave_balances_unique UNIQUE (employee_id, leave_type_id, year)
);

-- Justification: FK index (the unique constraint above already covers employee_id).
CREATE INDEX idx_leave_balances_leave_type ON leave_balances (leave_type_id);
-- Justification: the HR list filters by year and sorts by employee.
CREATE INDEX idx_leave_balances_year ON leave_balances (year, employee_id);

CREATE TABLE holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  holiday_date DATE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT holidays_name_not_blank CHECK (char_length(btrim(name)) > 0),
  CONSTRAINT holidays_date_unique UNIQUE (holiday_date)
);

-- Defaults of D-12: Annual 18 (carry forward up to 5), Casual 6, Sick 12 (back-dating up to 7 days), Unpaid without a balance.
INSERT INTO leave_types (id, code, name, has_balance) VALUES
  ('71000000-0000-4000-8000-000000000001', 'ANNUAL', 'Annual leave', TRUE),
  ('71000000-0000-4000-8000-000000000002', 'CASUAL', 'Casual leave', TRUE),
  ('71000000-0000-4000-8000-000000000003', 'SICK', 'Sick leave', TRUE),
  ('71000000-0000-4000-8000-000000000004', 'UNPAID', 'Unpaid leave', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO leave_policies (id, leave_type_id, annual_days, carry_forward_max, allow_half_day, max_backdate_days) VALUES
  ('72000000-0000-4000-8000-000000000001', '71000000-0000-4000-8000-000000000001', 18, 5, TRUE, 0),
  ('72000000-0000-4000-8000-000000000002', '71000000-0000-4000-8000-000000000002', 6, 0, TRUE, 0),
  ('72000000-0000-4000-8000-000000000003', '71000000-0000-4000-8000-000000000003', 12, 0, TRUE, 7),
  ('72000000-0000-4000-8000-000000000004', '71000000-0000-4000-8000-000000000004', 0, 0, TRUE, 0)
ON CONFLICT DO NOTHING;
