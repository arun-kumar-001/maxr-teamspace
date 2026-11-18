# Project status

## Manual leave approver selection - 2026-11-18

Supersedes the automatic preview below. Apply Leave now requires a manual approver-role selection from the authenticated employee's allowed options. The Leave Policies default-approver card is removed. Submission uses and revalidates the selection; HR leave remains Admin-only and self-approval is blocked. The leave submit client now uses the shared authenticated/CSRF helper and sends its required idempotency header. Existing saved requests are unchanged.

Verification approved and completed on 2026-11-18 for the local working-tree revision on `codex/hr-leave-approval`:

- API Vitest: `requests.access.test.ts` (75 passed), `approvals.service.test.ts`, `leave-routing.test.ts` and `openapi.test.ts` (49 passed combined). Covers role choices, unavailable TL, missing/invalid choices, HR/Admin constraints, self-approval, decision-role denial and idempotent requests.
- PostgreSQL: `npm run test:db --workspace=@maxr/api -- src/modules/leave/requests/requests.db.test.ts` (26 passed). Uses isolated leave-policy fixtures and cleans them up; verifies saved routes, assigned TL approval, deactivated TL rejection, transactional rollback, balances and concurrency. Initial runs exposed missing seed assumptions and fixture formatting, corrected in the test setup without seeding business data.
- Web Vitest: `LeaveApplication.test.tsx` (13 passed), `LeavePoliciesAndHolidays.test.tsx` (7 passed), `leave-client.test.ts` (3 passed). Covers manual selection, disabled submission until selection, selected payload, retry, CSRF/session headers, idempotency key and rejected-request propagation.
- Playwright: `leave-approval-routing.spec.ts` (18 phone/tablet/desktop scenarios passed). The six modified manual-selection/card-removal scenarios were rerun after correcting a malformed mocked POST response; all six passed with browser-error assertions and saved-request checks. Browser API responses are mocked. Phone and desktop screenshots were inspected.
- API/web `tsc --noEmit`, changed-file ESLint/Prettier and `git diff --check` passed. The only runtime source change in this verification turn removes the obsolete automatic-preview response type; routing behavior is unchanged.

No full local suite was run. Changes remain local and uncommitted; server deployment is not part of this verification.

## Apply Leave approver preview - 2026-11-18

Apply Leave now shows a read-only **Request goes to** role from the authenticated caller's backend routing preview. HR Manager, Team Lead and Admin labels follow the same routing service used on submission. Loading, error and retry states are included. No migration is needed for this preview; submission remains authoritative if settings change while the form is open.

Verification for this local working-tree revision: leave request/setup HTTP tests (108 passed), LeaveApplication component tests (13 passed), OpenAPI tests (7 passed), and the updated routing fixture (1 passed). The three new mocked-browser checks passed on phone, tablet and desktop; screenshots were inspected on phone and desktop. API/web `tsc --noEmit`, changed-file ESLint/Prettier and `git diff --check` passed. API HTTP tests require local port access outside the restricted sandbox. These changes are not committed or deployed.

## Configurable leave approval routing - 2026-11-17

Local implementation adds HR approval by default, Admin approval for HR leave, and an HR/Admin-managed switch to Team Lead routing in Leave Policies. Migration `20261117000003_leave_approval_routing.sql` adds the setting and Admin stage. Pending leave is aligned with the initial HR policy while completed stages and decisions are preserved. Subsequent setting changes affect new requests.

Verified with targeted API authorization/routing and notification tests, 78 PostgreSQL integration tests, clean/repeated migrations and seeds, and an upgrade preserving completed approval stages. UI/component checks and phone/tablet/desktop Playwright checks passed. Browser API responses are mocked in those Playwright checks. API/web TypeScript and changed-file lint checks passed.

The local development database was backed up and migrated to version 52 on 2026-11-18. Its default approver is HR Manager. Local API, database and Redis health checks passed.

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
