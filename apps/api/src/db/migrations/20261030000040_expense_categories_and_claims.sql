-- Expense categories and claims tables (#29, decision D-17).
--
--   * Tracks business expense claims submitted by employees with receipt uploads
--   * Minor unit currency (amount_paise) in INR, max ₹100,000.00 per claim
--   * Receipts stored via platform storage adapter; signed links generated for access
--   * Approvals engine two-step workflow (manager -> HR) or HR only
--   * States: submitted -> approved | rejected -> reimbursed, plus cancelled

CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expense_category_name_not_blank CHECK (char_length(btrim(name)) > 0)
);

CREATE INDEX idx_expense_categories_active ON expense_categories (is_active);

-- Seed default expense categories per spec D-17
INSERT INTO expense_categories (name, description) VALUES
  ('Travel', 'Travel expenses including flights, trains, taxis, and fuel'),
  ('Meals', 'Food and dining expenses incurred during business work'),
  ('Accommodation', 'Hotel and lodging expenses for official business'),
  ('Office supplies', 'Stationery, hardware peripherals, and desk essentials'),
  ('Client entertainment', 'Hosting, client meetings, and partner dinners'),
  ('Other', 'Miscellaneous business-related expenses')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
  amount_paise INT NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'INR',
  expense_date DATE NOT NULL,
  description TEXT NOT NULL,
  receipt_storage_key VARCHAR(500),
  receipt_filename VARCHAR(255),
  receipt_mime_type VARCHAR(100),
  receipt_file_size INT,
  status VARCHAR(20) NOT NULL DEFAULT 'submitted',
  rejection_reason TEXT,
  reimbursed_at TIMESTAMPTZ,
  reimbursed_by_employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_expense_claim_amount CHECK (amount_paise > 0 AND amount_paise <= 10000000),
  CONSTRAINT chk_expense_claim_status CHECK (status IN ('submitted', 'approved', 'rejected', 'reimbursed', 'cancelled')),
  CONSTRAINT chk_expense_claim_currency CHECK (currency = 'INR'),
  CONSTRAINT chk_expense_claim_desc CHECK (char_length(btrim(description)) > 0)
);

CREATE INDEX idx_expense_claims_employee ON expense_claims (employee_id, created_at DESC);
CREATE INDEX idx_expense_claims_status ON expense_claims (status);
CREATE INDEX idx_expense_claims_category ON expense_claims (category_id);
CREATE INDEX idx_expense_claims_date ON expense_claims (expense_date DESC);

