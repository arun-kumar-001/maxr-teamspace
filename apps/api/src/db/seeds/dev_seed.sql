-- ==============================================================================
-- Development Seed Data (Safe for Local Development Only)
-- ==============================================================================

INSERT INTO company_settings (id, company_name, timezone, work_week_start, work_week_end)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'MAXR Teamspace Local Dev',
  'UTC',
  'Monday',
  'Friday'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  timezone = EXCLUDED.timezone,
  updated_at = NOW();

