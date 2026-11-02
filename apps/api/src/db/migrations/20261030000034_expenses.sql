-- Expense claims and their categories (#29, decision D-17).
--
--   * money is integer minor units (paise) in INR; a claim is 0.01 to 100,000.00
--   * status moves draft -> submitted -> approved | rejected; approved -> reimbursed;
--     submitted or draft -> cancelled. The allowed moves are enforced in the service.
--   * a receipt is attached while the claim is a draft and is not replaced afterwards
--   * the category list is HR-managed; deactivating a category keeps old claims readable

CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expense_categories_code_format CHECK (code ~ '^[a-z][a-z0-9_]*$'),
  CONSTRAINT expense_categories_name_not_blank CHECK (char_length(btrim(name)) > 0)
);

INSERT INTO expense_categories (code, name) VALUES
  ('travel', 'Travel'),
  ('meals', 'Meals'),
  ('accommodation', 'Accommodation'),
  ('office_supplies', 'Office supplies'),
  ('client_entertainment', 'Client entertainment'),
  ('other', 'Other');

CREATE TABLE expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  expense_date DATE NOT NULL,
  amount_minor BIGINT NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  description VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  receipt_key VARCHAR(200),
  receipt_name VARCHAR(255),
  receipt_content_type VARCHAR(100),
  receipt_size BIGINT,
  receipt_sha256 CHAR(64),
  submitted_at TIMESTAMPTZ,
  decided_at TIMESTAMPTZ,
  reimbursed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT expense_claims_amount_range CHECK (amount_minor BETWEEN 1 AND 10000000),
  CONSTRAINT expense_claims_currency_check CHECK (currency = 'INR'),
  CONSTRAINT expense_claims_status_check CHECK (
    status IN ('draft', 'submitted', 'approved', 'rejected', 'cancelled', 'reimbursed')
  ),
  CONSTRAINT expense_claims_description_not_blank CHECK (
    description IS NULL OR char_length(btrim(description)) > 0
  ),
  CONSTRAINT expense_claims_receipt_complete CHECK (
    (receipt_key IS NULL) = (receipt_sha256 IS NULL)
    AND (receipt_key IS NULL) = (receipt_name IS NULL)
    AND (receipt_key IS NULL) = (receipt_size IS NULL)
  )
);

-- Justification: FK index and "my claims, newest first".
CREATE INDEX idx_expense_claims_employee ON expense_claims (employee_id, created_at);
-- Justification: FK index for category deactivation and reporting by category.
CREATE INDEX idx_expense_claims_category ON expense_claims (category_id);
-- Justification: the HR reimbursement queue and the status filters of the review lists.
CREATE INDEX idx_expense_claims_status ON expense_claims (status, created_at);
