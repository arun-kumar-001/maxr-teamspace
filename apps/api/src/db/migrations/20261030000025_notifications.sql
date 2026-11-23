-- In-app notifications (#41, decision D-15).
--
--   * a notification belongs to one employee, who is the only one who can read it
--   * `dedupe_key` makes a notification idempotent per recipient: the same event twice (a retry,
--     a repeated reminder run) creates one row, and so one email
--   * read notifications are removed after 90 days by the retention job; unread ones stay

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(150) NOT NULL,
  body VARCHAR(1000) NOT NULL,
  link VARCHAR(200),
  dedupe_key VARCHAR(200),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT notifications_type_format CHECK (type ~ '^[a-z][a-z_.]*$'),
  -- A path inside the app. '//host' is refused: a browser reads it as another site.
  CONSTRAINT notifications_link_relative CHECK (link IS NULL OR link ~ '^/([^/\s][^\s]*)?$'),
  CONSTRAINT notifications_title_not_blank CHECK (char_length(btrim(title)) > 0)
);

-- Justification: idempotent notifications per recipient.
CREATE UNIQUE INDEX uq_notifications_dedupe
  ON notifications (recipient_employee_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
-- Justification: the inbox, newest first (also the FK index).
CREATE INDEX idx_notifications_inbox ON notifications (recipient_employee_id, created_at DESC);
-- Justification: the unread badge counts only unread rows.
CREATE INDEX idx_notifications_unread
  ON notifications (recipient_employee_id) WHERE read_at IS NULL;
-- Justification: the retention job finds read rows by age.
CREATE INDEX idx_notifications_retention ON notifications (read_at) WHERE read_at IS NOT NULL;
