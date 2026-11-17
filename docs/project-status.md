# Project status

## Designation code removed — 2026-11-17

Designation forms now collect title and department. The API, shared contracts, employee/profile projections and seeds no longer include designation code. Migration `20261117000002_remove_designation_code.sql` drops the column while UUID relationships support employee assignment and onboarding. Existing department and employee code fields continue to serve their business identifiers.


## Department and designation name display — 2026-11-17

Department/designation codes are entered in their create/edit forms. Cards, details, tables, filters and employee/profile displays show names. Employee codes continue to identify individual employees.


## Designation hierarchy level removed — 2026-11-17

Migration `20261117000001_remove_designation_level.sql` removes `designations.level`. Designation and employee directory contracts, CRUD SQL, forms, displays, sorting and development seeds now omit the field. Existing department/designation UUID relationships and manager-based reporting hierarchy continue to drive employee creation and onboarding.

Verified with targeted PostgreSQL tests including employee-to-onboarding linkage, a clean migration of all 50 SQL files, and two seed runs on an isolated database. The local database has been migrated. Deployment requires the new migration before running the updated API.


## Department details and designation creation — 2026-11-17

The department details use a compact, full-height sidebar with square corners, a plain summary, and flat designation and team-member lists. Admin and HR Manager can create a designation for the selected active department using the existing designation API and form. Saved titles immediately appear in the drawer and are available through Add Employee's department-filtered designation lookup.

Verified 33 targeted department and employee tests, web TypeScript, changed-file lint, and overflow checks at all nine reference viewport sizes. Changes are local on `codex/department-designations`.

## Local development resumed — 2026-11-16

Docker's stalled WSL backend was restarted. MAXR Redis now uses host port `6380` in the ignored local `.env`, because another project's Redis occupies `6379`. The frontend runs on `3000` and the API on `4000`.

Typecheck, lint, and formatting checks passed. The targeted frontend checks passed after retrying two resource-related test failures with one worker.

## Admin portal fresh-entry cleanup — 2026-11-13

- Dashboard metrics, tasks, meetings, and approvals start empty and use API responses. Failed approvals no longer report success.
- Timesheets show recorded attendance durations, breaks, and sessions. Removed invented hours, daily breakdowns, discrepancies, and browser-only approvals.
- Attendance date selection uses the current date. Removed development preview history and invented employee identities.
- The profile portal uses the existing employee-profile view plus real tasks, meetings, payslips, and attendance. Removed sample identity cards, pay, progress, calendar events, and locally toggled checklist tasks.
- Time tracking starts checked out with zero elapsed time and updates from the server. Failed check-in/out requests show an error.
- Hiring starts empty. Legacy browser storage is cleared on refresh; new manual entries persist in version 2 browser storage. Hiring remains browser-local rather than a server-backed recruitment workflow.

The local development database was cleared at the user's explicit request. Business records and non-admin accounts were removed. The admin account, its required employee/department/designation, roles/permissions, company and attendance configuration, migrations, and append-only security audit history were retained. Re-running `npm run db:seed` recreates demonstration data.

No API contract, migration, dependency, or shared UI component changes were needed.
