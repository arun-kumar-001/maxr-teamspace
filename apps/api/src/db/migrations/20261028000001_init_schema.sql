-- ==============================================================================
-- Initial Database Migration (TL-02 Baseline)
-- Establishes pgcrypto extension and company_settings baseline table
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name VARCHAR(255) NOT NULL DEFAULT 'MAXR Teamspace',
  timezone VARCHAR(100) NOT NULL DEFAULT 'UTC',
  work_week_start VARCHAR(20) NOT NULL DEFAULT 'Monday',
  work_week_end VARCHAR(20) NOT NULL DEFAULT 'Friday',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

