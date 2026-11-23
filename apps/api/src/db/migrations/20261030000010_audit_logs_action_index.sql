-- Audit log viewer (#28): filtering by action or module within a date range.
-- Index (justification: the Admin search filters by action (exact or `module.%` prefix) and
-- sorts by time; without it that filter scans the whole append-only table as it grows).
-- text_pattern_ops makes the `LIKE 'module.%'` prefix search use the index.
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_occurred_at
  ON audit_logs (action text_pattern_ops, occurred_at DESC);
