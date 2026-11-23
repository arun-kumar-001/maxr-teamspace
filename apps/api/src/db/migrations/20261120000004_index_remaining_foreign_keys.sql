-- AGENTS.md section 6: every foreign key is indexed. Nine were not. Each index serves the
-- ON DELETE / ON UPDATE checks on the referenced table (they scan the referencing column) and the
-- lookups "everything this person verified / published / reimbursed / deleted" and "everything of
-- this leave type or policy". The tables are small and the migration runs in a transaction, so a
-- plain CREATE INDEX is used.
CREATE INDEX IF NOT EXISTS idx_onboarding_items_verified_by ON onboarding_items (verified_by);
CREATE INDEX IF NOT EXISTS idx_employee_documents_deleted_by
  ON employee_documents (deleted_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_reimbursed_by
  ON expense_claims (reimbursed_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_published_by ON payslips (published_by_employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_policy_rule_items_leave_type
  ON leave_policy_rule_items (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_employee_leave_policy_assignments_policy
  ON employee_leave_policy_assignments (policy_id);
CREATE INDEX IF NOT EXISTS idx_leave_ledger_transactions_leave_type
  ON leave_ledger_transactions (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_encashments_leave_type ON leave_encashments (leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_accrual_logs_leave_type ON leave_accrual_logs (leave_type_id);
