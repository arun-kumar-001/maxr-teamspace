# Developer Work Breakdown

**Status:** Draft for TL review — **no GitHub issues have been created.** Each entry below is written to be pasted into a GitHub issue once the TL approves.
Everything here is **[RECOMMENDED]** structure built on **[CONFIRMED]** report requirements (cited). Items touching an open decision are tagged **[D-nn]** and must not start until it is closed.

Owners: **TL** Technical Lead · **D1** Developer 1 (`feature/employee-management`) · **D2** Developer 2 (`feature/attendance-collaboration`).
Priority: **P0** blocks others · **P1** core · **P2** important · **P3** optional/late. Size: S/M/L (see roadmap).
Each issue spans DB + backend + business logic + UI + tests; none is "UI only".

## Global Definition of Done (every issue)
- [ ] Acceptance criteria met and demonstrated (screenshots/curl for reviewer).
- [ ] Every route declares a permission; **backend** enforces role + record scope; deny by default.
- [ ] Input validated with shared schemas; errors use the standard envelope; lists paginated.
- [ ] Migrations versioned, reversible where supported, indexes justified; no edits to others' tables/files.
- [ ] Tests: unit (rules), integration (real PostgreSQL, role matrix incl. cross-scope denial), component/e2e for critical UI. CI green: typecheck, lint, tests, audit, secret scan.
- [ ] UI has loading, empty, error, access-denied, validation and submitting states; WCAG 2.1 AA; uses shared tokens/components only.
- [ ] **Responsive:** works from phone (320px) to ultrawide (3440px) per `AGENTS.md` §8 "Responsive and fluid layout": no horizontal page scroll, tables→cards on phone, layout uses the extra space on large monitors, checked at the 9 reference viewports; screenshots at phone and desktop attached to the PR.
- [ ] Audit log entry for sensitive actions; no secrets/PII in logs.
- [ ] Docs updated (API in OpenAPI/`docs/architecture`, `docs/project-status.md`); PR description lists risks and rollback.
- [ ] Reviewed and approved by TL.

## Parallelism overview
```
TL-01 → TL-02 → TL-03 → TL-04 → TL-05 → TL-06 → TL-07 → TL-08 → TL-09 → TL-10 → TL-11 → TL-12   (P0, sequential, TL)
                         └─ after TL-04..TL-07 + TL-10 merge to main ─┐
D1 : 01 → 02 → 03 → 04/05 (parallel) → 06 → 07 → 08 → 09 → 10 → 11 → 13 → 12 → 14 → 15
D2 : 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 13 → 14(opt) → 15 → 16
TL : 13 reports framework (starts after D1-02 & D2-03 patterns exist) → 14 hardening → 15 launch
```
Wait points: D1-08 waits TL-11 + D-10; D1-12 waits D2-05; D2-04/07/08 wait D2-05 design; D1/D2 team-scoped work waits TL-06 and D-11; D2-14 waits D-18; TL-13 waits D-08.

---
# A. Technical Lead — Global Foundation (branch `feature/global-setup`)

### TL-01 · Stack ADR and repository scaffold — P0 · M
- **Scope:** record ADR for D-02..D-05, D-09; monorepo (`apps/web`, `apps/api`, `packages/shared`); TypeScript strict, lint/format, module folder template, path aliases, `.env.example`.
- **AC:** clean clone builds; sample module template documented; ADR merged; no feature code.
- **Depends:** D-02..D-05 decided. **Permissions:** n/a. **Tests:** build/typecheck in CI.

### TL-02 · Local dev environment — P0 · S
- **Scope:** Docker Compose (PostgreSQL 16, Redis, mail sink, storage fake), seed script entry, one-command start, README setup.
- **AC:** new machine to running app < 30 min following docs; healthcheck endpoint.

### TL-03 · CI quality gates — P0 · M
- **Scope:** GitHub Actions: install, typecheck, lint, unit, integration (Postgres service), build, `npm/pnpm audit`, secret scan, migration up on clean DB; PR template; branch protection recommendation.
- **AC:** failing test/lint blocks merge; required checks listed in `docs/development`.

### TL-04 · Database foundation and base schema — P0 · L
- **Scope:** migration tool; tables `users, roles, permissions, role_permissions, user_roles, departments, designations, employees, audit_logs, sessions` (+ constraints, indexes); `users.employee_id` 1:1 [G-04]; seeds: 4 roles, permission catalog, one user/employee per role, sample departments/designations.
- **AC:** migrate up/down on empty DB; seed idempotent; ER doc updated; FKs/indexes reviewed.
- **Depends:** TL-01, TL-02; **ER approval G-03/G-04/G-16**.

### TL-05 · Authentication and sessions (M1 core) — P0 · L
- **Scope:** `POST /auth/login` (rate-limited, generic errors), logout, session/refresh per D-05, password hashing Argon2id, lockout/backoff, session revocation API used by deactivation, password change; security headers, cookie flags.
- **AC:** login for 4 seeded roles; revoked/expired sessions rejected; brute-force limited; audit rows for login success/failure.
- **Tests:** unit + integration; token expiry; revocation; rate limit.
- **Depends:** TL-04, D-05.

### TL-06 · RBAC and record-scope engine — P0 · L
- **Scope:** permission catalog `module.action`, route guard middleware, scope resolver `own/team/hr/all` (`manager_id`, D-11), repository helper to inject scope filters, 404-on-out-of-scope policy, CI check that every route has a permission, test utilities (login as role, IDOR helper).
- **AC:** matrix in `role-permission-matrix.md` §2 encodable as table-driven tests; a route without permission fails CI.
- **Depends:** TL-04, TL-05, D-11, D-21.

### TL-07 · API conventions — P0 · M
- **Scope:** `/api/v1` router, validation (shared schemas), error envelope with `requestId`, pagination helper, idempotency/409 helper, structured logging with PII redaction, OpenAPI generation, health endpoint, rate-limit middleware.
- **AC:** sample module demonstrates all conventions; OpenAPI published.

### TL-08 · Design tokens — P0 · S
- **Scope:** CSS variables/Tailwind theme from approved palette (D-22), typography (fluid `clamp()` scale), spacing, radius, status colors, dark shell, **breakpoint tokens `xs 360 → 4xl 2560`**, container max-widths, contrast check script.
- **AC:** one source of tokens; no hex outside token file (lint rule); AA contrast verified; breakpoints defined only here.
- **Note:** palette is currently provisional.

### TL-09 · Shared UI components — P0 · L
- **Scope:** Button, Input, Select, DataTable (pagination/sort), Modal, Badge/StatusPill (leave+task mappings), EmptyState, ErrorState, ForbiddenState, Toast, FormField, Skeleton, Tabs, DatePicker, FileUpload; docs page; component tests.
- **Responsive scope:** DataTable has phone card layout + tablet column priority; Modal becomes full-screen sheet on phone; forms stack on phone and use multi-column grids on desktop/large screens; page-layout primitives (`PageContainer`, `Grid`, `SplitPane`, `Stack`) handle fluid widths and ultrawide max-widths; touch targets ≥44px.
- **AC:** keyboard/ARIA tested; used by app shell; Storybook or docs route; each component demonstrated at 360, 768, 1280, 1920 and 3440px with Playwright viewport screenshots.

### TL-10 · Application shell and four role views — P0 · L
- **Scope:** login page, layout, role-based navigation registry (modules register `nav.ts`/`routes.ts`), route guards, 403/404/error pages, four dashboard shells (Admin, HR, Team Lead, Staff) with placeholder widgets, session handling, fully responsive layout: bottom nav/drawer (phone) → icon rail (tablet) → full sidebar (desktop) → expanded multi-column dashboards on large/ultrawide monitors.
- **AC:** every shell page and dashboard passes the 9-viewport check with no horizontal scroll; each seeded role sees only its nav; direct URL to forbidden route shows access-denied; backend still authoritative.
- **Depends:** TL-05, TL-08, TL-09.

### TL-11 · Shared services: audit, notifications outbox, storage adapter — P0 · L
- **Scope:** audit logger API; notification service interface + outbox + email adapter (SMTP/SendGrid, fake for tests); storage adapter interface (Cantobo + local fake, signed links, size/type allow-list); event emit helper.
- **AC:** modules call interfaces only; contract tests run against fakes; D-10 documented.
- **Depends:** TL-04, D-10 (fake first).

### TL-12 · Developer enablement — P0 · S
- **Scope:** `docs/development` (setup, conventions, testing, Git workflow, PR rules, module template), PR/issue templates, CODEOWNERS for shared files, branch creation for D1/D2.
- **AC:** a developer completes setup and the module template exercise using only the docs.

### TL-13 · Reports framework and exporters (M8) — P2 · L  *(after patterns exist; D-08)*
- **Scope:** report registry (`GET /reports/{name}`), scope-aware query contract, CSV + PDF exporters, async for large exports, audit of exports; modules supply report definitions.
- **AC:** Admin/HR/TeamLead(team) access per matrix; exports audited.

### TL-14 · Security hardening and review — P1 · L (Phase 7)
- **Scope:** threat model `docs/security`, OWASP ASVS checklist, dependency/image scanning, headers/CSP, upload scanning hook, secrets management, penetration-style tests of IDOR/mass-assignment, log review, data retention (D-25).
### TL-15 · Deployment, backups and launch — P1 · L (Phase 7)
- **Scope:** Dockerfiles, Nginx (TLS, rate limit, `/api/v1/*`), GitHub Actions deploy to Cantobo, staging, backup/restore drill, monitoring/alerts, runbook, launch checklist.

**TL standing duty:** integration review of every PR into `main`; owns shared files (AGENTS.md §12).

---
# B. Developer 1 — Employee Management (branch `feature/employee-management`)

All D1 issues depend on **TL-04..TL-07, TL-10** merged to `main` (can plan/prototype earlier in own folders only).

### D1-01 · Departments and designations — P1 · M
- **Scope:** tables CRUD (`departments`, `designations` with level/dept FK, `is_active`), `GET /departments`, `GET /designations` [C F2] + `POST/PUT` [R]; admin UI pages; deactivate not delete; prevent deleting in-use rows.
- **Permissions:** read Admin, HR [C]; write Admin, HR ◐. **Tests:** uniqueness of code, in-use protection, role matrix.
- **AC:** HR can maintain structure; Staff/Team Lead denied writes; audit written.

### D1-02 · Employee directory: list, search, filters — P1 · M
- **Scope:** `GET /employees` [C] with filters (dept, designation, status, manager, text), sort, pagination; directory UI with table/cards; scope per role (Admin all, HR hr, Team Lead team [C F2]).
- **Permissions:** Admin, HR, Team Lead(team). **DB:** `employees` indexes (code, name, dept, manager).
- **Tests:** scope per role, pagination bounds, SQL-injection-safe search, performance with 10k rows.
- **AC:** Team Lead never sees outside team; empty/error states present.

### D1-03 · Create employee (atomic) — P1 · L
- **Scope:** `POST /employees` [C]: validate, duplicate employee-code check, insert employee + user (status `pending`) + assign role, commit, then onboarding notification via outbox [C F2 seq.3]; creation form (stepper); departments/designations/manager pickers.
- **Permissions:** Admin, HR. **Depends:** D1-01, TL-11. **[D-20]** for activation semantics.
- **Tests:** transaction rollback on failure (no orphan user), duplicate code 409, email only after commit, field validation.
- **AC:** no partial records on any failure; audit row; HR can create, Staff/TL denied.

### D1-04 · Employee detail and update with field-level permissions — P1 · M
- **Scope:** `GET/PUT /employees/{id}` [C]; field-level matrix (public/HR/sensitive); sensitive fields behind explicit permission [C T§2.1]; optimistic concurrency (`updated_at`/version); detail UI with tabs.
- **Permissions:** Admin, HR(limited) [C], Team Lead read team, Staff own.
- **Tests:** mass-assignment, IDOR, sensitive-field redaction per role, concurrent update 409.

### D1-05 · My profile (`/employees/me`) — P1 · S  *(parallel with D1-04)*
- **Scope:** `GET/PUT /employees/me` [C]; allowed-fields whitelist; profile photo upload (via storage adapter, later); UI.
- **AC:** Staff cannot change role, manager, code, status, department; audit on change.

### D1-06 · Reporting hierarchy — P1 · M
- **Scope:** assign/change manager, cycle prevention, direct reports list, org chart view; exposes data used by TL-06 team scope (no change to TL-06 code; contract tests).
- **Permissions:** Admin, HR. **Tests:** cycle, self-manager, manager deactivated, team-scope recalculation.

### D1-07 · Onboarding workflow — P1 · L  **[D-20]**
- **Scope:** 4-step state machine HR → System → IT/Admin → Employee [C T§4.1], `onboarding_checklists/items` tables, step owners and verification, account activation only when all items verified, notifications to next owner, onboarding board UI per role.
- **Permissions:** step owner roles only. **Tests:** illegal skips, partial completion, activation gate, re-open.
- **AC:** user cannot log in until activation; audit trail per step.

### D1-08 · Employee documents with signed links — P1 · L  **[D-10, D-25]**
- **Scope:** `GET /employees/{id}/documents` [C], upload, download via short-lived signed link, `document_type` enum, `is_sensitive`, size/type allow-list, soft-delete (`is_active`); UI tab; uses TL-11 storage adapter.
- **Permissions:** HR, Admin [C]; Staff own list ◐. **Tests:** ACL on every download, link expiry, tampered link, file-type spoofing.
- **Depends:** TL-11, D1-04.

### D1-09 · Deactivation and offboarding — P1 · M  **[D-19, D-23]**
- **Scope:** `POST /employees/{id}/deactivate` [C]: set status, deactivate user, **revoke all sessions** via TL-05, reassign/flag reports and open items, offboarding checklist, audit; UI with confirmation.
- **Permissions:** Admin; HR if delegated [C F2].
- **Tests:** active sessions rejected immediately; idempotent; historical data retained.

### D1-10 · User and role administration UI — P2 · M
- **Scope:** `GET /users`, `GET /users/{id}`, `PUT /users/{id}/roles`, `GET /roles`, `GET /permissions`; Admin pages; role assignment rules (D-21).
- **Permissions:** Admin only. **Tests:** cannot remove last admin; role change audited; HR denied.

### D1-11 · Audit log viewer — P2 · S
- **Scope:** `GET /audit-logs` with filters (actor, action, entity, date), pagination, export-safe view; Admin UI.
- **Permissions:** Admin. **Tests:** immutability (no write API), redaction.

### D1-13 · Company settings — P2 · M  *(Phase 6)*
- **Scope:** `company_settings` table, `GET/PUT /settings` (company profile, timezone, work week, integrations toggles, security settings) consumed by D2 modules through a read interface only.
- **Permissions:** Admin. **Tests:** validation, audit, caching invalidation.

### D1-12 · Expense claims — P2 · L  *(Phase 6; waits D2-05, D-17)*
- **Scope:** `expense_claims`, categories, submit with receipt (storage adapter), approve/reject through approvals engine, notifications, lists per role; UI.
- **Permissions:** Staff own, approver per D-17. **Tests:** receipt ACL, amount validation, state machine, scope.

### D1-14 · HR/workforce report definitions — P2 · M  *(Phase 6; waits TL-13)*
- **Scope:** headcount, joiners/leavers, directory export definitions using TL-13 contract.

### D1-15 · Employee module hardening and e2e — P1 · M  *(Phase 7)*
- **Scope:** Playwright flows (create→onboard→activate→deactivate), full role matrix tests, accessibility pass, performance check, docs.

---
# C. Developer 2 — Attendance, Leave, Collaboration (branch `feature/attendance-collaboration`)

All D2 issues depend on **TL-04..TL-07, TL-10**. Team-scoped features also need **TL-06 + D-11**.

### D2-01 · Shifts and attendance policies — P1 · M  **[D-13]**
- **Scope:** `shifts`, `employee_shifts`, `attendance_policies` (grace period, work hours, timezone from company settings), `GET/PUT /attendance/policies`, UI for HR.
- **Permissions:** HR [C]; read Admin/Team Lead. **Tests:** timezone boundaries, overlapping shifts.

### D2-02 · Attendance check-in / check-out — P1 · M
- **Scope:** `POST /attendance/check-in|check-out` [C]; server time; **partial unique index** one open session [C]; status derivation (present/late) per policy; `location` handling per D-13; Staff widget on dashboard.
- **Permissions:** Staff own (all roles own session). **Tests:** concurrent double check-in, check-out without open session, midnight rollover, deactivated user blocked.
- **AC:** 409 on duplicate; audit; works for all four roles for themselves.

### D2-03 · Attendance views and history — P1 · M
- **Scope:** `GET /attendance/me`, `GET /attendance` (team/hr/all scope), calendar and list UI, filters, Team Lead team grid.
- **Permissions:** own / Team Lead team [C] / HR / Admin. **Tests:** scope matrix, pagination, IDOR.

### D2-04 · Attendance correction requests — P1 · M  **[D-13]**
- **Scope:** `attendance_corrections` table (requested times, reason, status), `POST /attendance/corrections`, list, UI; applies through approvals engine.
- **Permissions:** Staff own create; approve Team Lead/HR [C]. **Depends:** D2-05.
- **Tests:** approval mutates attendance atomically; double-approve idempotent.

### D2-05 · Approvals engine (M4a) — P0 for D2/D1-12 · L
- **Scope:** `approvals` table, `POST /approvals/{id}/approve` [C], `POST …/reject`, `GET /approvals` inbox (scoped), subject handler registry (leave, attendance-correction, later expense), transactional apply, no self-approval, optional comment, notifications.
- **Permissions:** Team Lead (team), HR Manager [C]; Admin ◐. **Tests:** scope, race on concurrent approvals (row lock), handler failure rolls back, audit.
- **Owner note:** single owner of approval workflow; D1-12 consumes it.

### D2-06 · Leave types, policies, balances, holidays — P1 · L  **[D-12]**
- **Scope:** `leave_types`, `leave_balances(employee, year, type)`, `holidays`, `leave_policies`; balance initialization/accrual job; `GET /leave-balances/me`, `GET/POST /holidays`, `GET/PUT /leave-policies`; HR UI + holiday calendar.
- **Permissions:** HR [C] manage; all read own balance/holidays.

### D2-07 · Leave application — P1 · M  *(waits D2-06)*
- **Scope:** `POST /leave-requests` [C] with date validation, overlap, balance check, holiday-aware day count; `GET /leave-requests[/me]`; apply form, My Leave page.
- **Permissions:** Staff own [C]. **Tests:** boundaries, overlap, insufficient balance, past dates policy.

### D2-08 · Leave approval, rejection, cancellation — P1 · L  *(waits D2-05, D2-07)*
- **Scope:** state machine Applied → Pending → Approved/Rejected → Cancelled [C; D-12]; approval updates **balance and state in one transaction** [C]; cancel restores balance; Team Lead and HR approver inbox; team leave calendar.
- **Permissions:** Team Lead (team), HR [C]. **Tests:** failure injection mid-transaction; balance never negative or double-deducted; cancel after approval; no self-approval.

### D2-09 · Notifications module features — P1 · M  **[D-15]**
- **Scope:** templates, in-app inbox (`GET /notifications`, mark read), email events for leave/attendance/task/approval, scheduled reminders (task due, pending approvals), announcements (Admin) ; bell UI. Uses TL-11 outbox/adapters.
- **Permissions:** own only; announcements Admin. **Tests:** only owner reads, retry on failure, no sensitive data in email, sent-after-commit.

### D2-10 · Projects — P1 · M  **[D-14]**
- **Scope:** `projects`, `project_members`; CRUD, membership, project list/detail UI.
- **Permissions:** Team Lead (team), Admin; members read. **Tests:** scope, membership rules.

### D2-11 · Task lifecycle and assignment — P1 · L
- **Scope:** `tasks` (+`project_id`), assignment within scope, priority, deadlines, transitions To Do → In Progress → In Review → Completed + Blocked [C], transition table (D-14), board and list UIs (own/team), notifications.
- **Permissions:** Team Lead assign (team) [C]; Staff update own [C]. **Tests:** illegal transitions 422, assign outside team denied, board filters.

### D2-12 · Task collaboration: comments and attachments — P2 · M
- **Scope:** `task_comments`, `task_attachments` via storage adapter, mentions optional; ACL = task visibility. **Tests:** attachment ACL, size/type limits.

### D2-13 · Meetings — P2 · M  **[D-18]**
- **Scope:** `meetings`, `meeting_attendees`, agenda, minutes; schedule/invite/list UI; reminders via D2-09.
- **Permissions:** organizer manage; invitees read; ◐ per role. **Tests:** visibility, time validation, overlapping warnings.

### D2-14 · Calendar sync (optional) — P3 · L  **[D-18]**
- **Scope:** Google/Outlook sync adapter behind interface, OAuth, one-way push first. **Not started until approved.**

### D2-15 · Attendance, leave and task report definitions — P2 · M  *(Phase 6; waits TL-13)*
- **Scope:** attendance summary, leave balance/usage, task/project status reports using TL-13 contract; scoped queries.

### D2-16 · Operations modules hardening and e2e — P1 · M  *(Phase 7)*
- **Scope:** Playwright (check-in, leave apply→approve, correction, task flow), role matrix, concurrency and transaction tests, accessibility, docs.

---
## Dashboards
Dashboard widgets are delivered inside the owning module issue: Admin/HR widgets by D1 issues; Staff/Team Lead widgets by D2 issues; shells and layout by TL-10.

## Items intentionally not assigned
Mobile app, SMS/OTP, payroll export/payslips, Excel export, OAuth2/SSO (optional per report figure; D-07, D-08, D-15, D-16). Payslips (D-16) needs an owner once the data source is defined.
