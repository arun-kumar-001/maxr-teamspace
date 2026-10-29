-- ==============================================================================
-- Approvals Engine Migration (Issue #37, D2-05)
-- Core approvals table supporting Leave, Attendance Corrections, and Expenses
-- ==============================================================================

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(50) NOT NULL,
  subject_id UUID NOT NULL,
  requester_id UUID NOT NULL,
  approver_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  comment TEXT,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approvals_status_type 
  ON approvals (status, subject_type);

CREATE INDEX IF NOT EXISTS idx_approvals_requester 
  ON approvals (requester_id);

CREATE INDEX IF NOT EXISTS idx_approvals_approver 
  ON approvals (approver_id);

CREATE INDEX IF NOT EXISTS idx_approvals_subject 
  ON approvals (subject_type, subject_id);
