-- Support daily recurring tasks that stay in daily updates.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_daily BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_last_done_date DATE;

