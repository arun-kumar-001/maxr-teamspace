-- Company settings (#30): make the table the single, always-present settings row.
--   * integration toggles (the adapters decide what "on" means)
--   * the row itself, so a production database that was never seeded still has settings
--   * a CHECK that keeps it the only row, and CHECKs on the work-week day names
-- Production defaults follow decision D-13: Asia/Kolkata, Monday to Friday.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM company_settings WHERE id <> '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'company_settings has rows with another id; keep one row with id 00000000-0000-0000-0000-000000000001 and delete the rest before migrating';
  END IF;
END $$;

ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS integrations JSONB NOT NULL
    DEFAULT '{"email": true, "sms": false, "calendarSync": false, "payrollExport": false}'::jsonb;

INSERT INTO company_settings (id, company_name, timezone, work_week_start, work_week_end)
VALUES ('00000000-0000-0000-0000-000000000001', 'MAXR Teamspace', 'Asia/Kolkata', 'Monday', 'Friday')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_singleton
    CHECK (id = '00000000-0000-0000-0000-000000000001'),
  ADD CONSTRAINT company_settings_work_week_start_check
    CHECK (work_week_start IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  ADD CONSTRAINT company_settings_work_week_end_check
    CHECK (work_week_end IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  ADD CONSTRAINT company_settings_integrations_check
    CHECK (jsonb_typeof(integrations) = 'object');
