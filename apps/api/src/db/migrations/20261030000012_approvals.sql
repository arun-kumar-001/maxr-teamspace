-- Approvals engine (#37): one approval per subject (a leave request, an attendance correction,
-- an expense claim), decided stage by stage. `stages` is the route fixed at submit time
-- ('manager' = the requester's manager, 'hr' = an HR Manager); `current_stage` indexes into it.

CREATE TABLE IF NOT EXISTS approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type VARCHAR(50) NOT NULL CHECK (subject_type ~ '^[a-z][a-z_]*$'),
  subject_id UUID NOT NULL,
  requester_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  stages TEXT[] NOT NULL
    CHECK (cardinality(stages) BETWEEN 1 AND 3 AND stages <@ ARRAY['manager', 'hr']::text[]),
  current_stage SMALLINT NOT NULL DEFAULT 0 CHECK (current_stage >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT approvals_subject_unique UNIQUE (subject_type, subject_id),
  CONSTRAINT approvals_stage_in_route CHECK (current_stage < cardinality(stages)),
  -- A finished approval has a decision time and an open one does not.
  CONSTRAINT approvals_decided_at_matches_status CHECK ((status = 'pending') = (decided_at IS NULL))
);

-- Foreign key index: the Staff "my requests" list and the Team Lead team scope filter on it.
CREATE INDEX IF NOT EXISTS idx_approvals_requester ON approvals (requester_employee_id);
-- The inbox lists open approvals oldest first; the reminder job (D-15) scans the same range.
CREATE INDEX IF NOT EXISTS idx_approvals_status_created ON approvals (status, created_at, id);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES approvals(id) ON DELETE CASCADE,
  stage SMALLINT NOT NULL CHECK (stage >= 0),
  decided_by_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  outcome VARCHAR(20) NOT NULL CHECK (outcome IN ('approved', 'rejected')),
  comment VARCHAR(500),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One decision per stage: a second decision on the same stage cannot be recorded.
  CONSTRAINT approval_decisions_stage_unique UNIQUE (approval_id, stage)
);

-- Foreign key index: "what did this person decide" and the four-eyes check.
CREATE INDEX IF NOT EXISTS idx_approval_decisions_decider ON approval_decisions (decided_by_employee_id);
