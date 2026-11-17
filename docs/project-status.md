# Project status

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
