-- Late-deduction policy, permission policy and company logo were kept only in each admin's
-- browser, so a change never reached other users or the server. They live with the company
-- settings row now. NULL means "never configured"; the screens then show defaults, labelled as such.
--
-- The logo is a small data URL. SVG is excluded on purpose: it can carry script. The CHECK repeats
-- the API's rules so nothing else can write a bigger or different file into this column.
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS company_logo TEXT,
  ADD COLUMN IF NOT EXISTS late_deduction_policy JSONB,
  ADD COLUMN IF NOT EXISTS permission_policy JSONB;

ALTER TABLE company_settings
  ADD CONSTRAINT company_settings_logo_check
    CHECK (company_logo IS NULL OR (
      length(company_logo) <= 300000
      AND company_logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$'
    )),
  ADD CONSTRAINT company_settings_late_deduction_check
    CHECK (late_deduction_policy IS NULL OR jsonb_typeof(late_deduction_policy) = 'object'),
  ADD CONSTRAINT company_settings_permission_policy_check
    CHECK (permission_policy IS NULL OR jsonb_typeof(permission_policy) = 'object');
