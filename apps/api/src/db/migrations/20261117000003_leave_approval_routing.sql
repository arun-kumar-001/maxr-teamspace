-- A singleton policy is read when submitting leave, so pending routes stay stable after edits.
CREATE TABLE leave_approval_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL UNIQUE DEFAULT true CHECK (singleton),
  approver_role TEXT NOT NULL DEFAULT 'hr_manager' CHECK (approver_role IN ('hr_manager', 'team_lead')),
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO leave_approval_settings (singleton) VALUES (true);

ALTER TABLE approvals DROP CONSTRAINT approvals_stages_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_stages_check
  CHECK (cardinality(stages) BETWEEN 1 AND 3 AND stages <@ ARRAY['manager', 'hr', 'admin']::text[]);

-- Keep completed stages and decisions while routing the pending step under the initial HR policy.
UPDATE approvals a
SET stages = COALESCE(a.stages[1:a.current_stage], '{}'::text[]) || CASE WHEN EXISTS (
      SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE u.employee_id = a.requester_employee_id AND r.key = 'hr_manager'
    ) THEN ARRAY['admin']::text[] ELSE ARRAY['hr']::text[] END,
    updated_at = NOW()
WHERE a.subject_type = 'leave_request' AND a.status = 'pending';
