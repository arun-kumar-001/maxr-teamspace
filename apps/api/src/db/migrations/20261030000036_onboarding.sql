-- Onboarding workflow schema (#24, D-20).
-- 4-step state machine: HR -> System -> IT/Admin -> Employee.
-- Account activates only after all checklist items are verified.

-- 1. Onboarding Checklists
CREATE TABLE IF NOT EXISTS onboarding_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  current_step VARCHAR(50) NOT NULL DEFAULT 'hr' CHECK (current_step IN ('hr', 'system', 'it_admin', 'employee', 'completed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Foreign key & filter indexes (justification: lookup by employee, status filtering, and board queries)
CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_employee_id ON onboarding_checklists (employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_status ON onboarding_checklists (status);
CREATE INDEX IF NOT EXISTS idx_onboarding_checklists_current_step ON onboarding_checklists (current_step);

-- 2. Onboarding Items (per-step checklist items)
CREATE TABLE IF NOT EXISTS onboarding_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES onboarding_checklists(id) ON DELETE CASCADE,
  step VARCHAR(50) NOT NULL CHECK (step IN ('hr', 'system', 'it_admin', 'employee')),
  item_key VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_onboarding_items_checklist_key UNIQUE (checklist_id, item_key)
);

-- Item indexes (justification: lookup items by checklist, filter by step and verification status)
CREATE INDEX IF NOT EXISTS idx_onboarding_items_checklist_id ON onboarding_items (checklist_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_items_step ON onboarding_items (step);
CREATE INDEX IF NOT EXISTS idx_onboarding_items_is_verified ON onboarding_items (is_verified);

-- 3. Set-Password Tokens (single-use, 72h hashed tokens for Step 4)
CREATE TABLE IF NOT EXISTS set_password_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Token indexes (justification: fast lookup by user and token hash)
CREATE INDEX IF NOT EXISTS idx_set_password_tokens_user_id ON set_password_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_set_password_tokens_token_hash ON set_password_tokens (token_hash);

