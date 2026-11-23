# Module Inventory

**Status:** Draft for TL review. Labels as in `docs/requirements/product-baseline.md`: **[C]** confirmed (report text `T§` or figure `F1`/`F2`), **[R]** recommended, **[D-nn]** needs decision.
Scope check against report T§1.1: all 8 modules are in scope. Nothing from T§1.2 (CRM, payroll processing, speculative fields) is mandatory work.

Common to every module [R]: layered `routes → service → repository`, permission declared per route, input schema validation, paginated lists, audit logging of writes, loading/empty/error/forbidden UI states, tests per `AGENTS.md` §10.

Naming: roles `admin | hr_manager | team_lead | staff` (D-01).

---

## M1 · User & Role Management
- **Purpose:** accounts, role assignment, permissions, session control, activity audit logs [C T§1.1]
- **Roles:** Admin (manage); HR (assign role at employee creation F2 §6); all (login/logout)
- **Pages [R]:** Login, Forgot/Reset password (D-05), Users list, User detail (roles, status, sessions), Roles & Permissions (read), Audit Logs
- **Functional reqs:** authenticate; role assign/revoke; permission check; token validation; deactivate account and end sessions [C F1, T§5.1]; audit log [C]
- **Rules:** deny by default [C]; deactivation revokes sessions [C]; login rate-limited [C]; passwords hashed, lockout/backoff [R]
- **APIs:** `POST /auth/login` [C]; `POST /auth/logout`, `POST /auth/refresh`, `POST /auth/change-password`, `GET /users`, `GET /users/{id}`, `PUT /users/{id}/roles`, `GET /roles`, `GET /permissions`, `GET /audit-logs` [R]
- **Tables:** `users`, `roles`, `permissions`, `role_permissions`, `user_roles` [C F2]; `audit_logs`, `sessions`/refresh tokens, `login_attempts` [R G-16]
- **Integrations:** Redis (sessions) [C T§3.1]; email for reset/activation
- **Depends on:** Foundation only. **Required by:** every module.
- **Tests:** login success/fail/rate limit; token expiry; revoked session; permission matrix; audit written. **AC:** matrix in `role-permission-matrix.md` §2 passes automatically.

## M2 · Employee Directory (Employee Management)
- **Purpose:** profiles, departments, designations, reporting lines, onboarding/offboarding [C T§1.1]
- **Roles:** Admin, HR (manage); Team Lead (team read); Staff (own)
- **Pages [R]:** Directory (search/filter), Employee detail, Create/Edit employee, My Profile, Departments, Designations, Org/reporting view, Onboarding board, Offboarding, Documents tab
- **Functional reqs:** CRUD employees; unique employee code; manager link; list with filters; self profile edit (allowed fields only); documents list/upload/download; deactivate [C]
- **Rules:** unique `employee_code`; create-employee = validate → insert employee → create user → commit → onboarding email in one transaction [C F2 seq.3]; sensitive fields need explicit permission [C T§2.1]; manager cycle prevention [R]; account activates only after all onboarding items verified [C T§4.1]
- **APIs:** `POST/GET /employees`, `GET/PUT /employees/{id}`, `POST /employees/{id}/deactivate`, `GET/PUT /employees/me`, `GET /departments`, `GET /designations`, `GET /employees/{id}/documents` [C]; `POST/PUT /departments|designations`, `POST /employees/{id}/documents`, `GET /documents/{id}/download` (signed link), onboarding/offboarding endpoints [R]
- **Tables:** `departments`, `designations`, `employees`, `employee_documents` [C F2]; `onboarding_checklists`, `onboarding_items`, `files` metadata [R G-03]
- **Integrations:** SMTP/SendGrid onboarding email; Cantobo storage with signed links [C T§5.2]
- **Depends on:** M1, Notifications skeleton, Storage adapter. **Required by:** M3–M8 (employee_id FK, team scope)
- **Tests:** unique code; atomic create; scoped list per role; IDOR; mass-assignment on `/me`; document access control. **AC:** `role-permission-matrix.md` employee rows pass; onboarding cannot activate with unverified items.

## M3 · Attendance & Shifts
- **Purpose:** check-in/out, shift rules, correction requests with approvals [C T§1.1]
- **Roles:** Staff (own); Team Lead (team review, approve corrections); HR (policies, approve); Admin
- **Pages [R]:** Check-in/out widget, My Attendance (calendar/list), Team Attendance, Correction request form, Approvals inbox (attendance), Shift & Policy settings
- **Functional reqs:** start/end session [C T§5.1]; one open session per employee [C]; corrections with approval [C]; policies [C F1]; location captured [F2 `location`, D-13]
- **Rules:** server time only; check-out requires open session; reject duplicate check-in with 409; correction approval updates attendance record and audit [R]
- **APIs:** `POST /attendance/check-in`, `POST /attendance/check-out` [C]; `GET /attendance`, `GET /attendance/me`, `POST /attendance/corrections`, `GET /attendance/policies`, `PUT /attendance/policies` [R]; approve via `/approvals/{id}/approve` [C]
- **Tables:** `attendance` [C F2]; `shifts`, `employee_shifts`, `attendance_corrections`, `attendance_policies` [R D-13]
- **Integrations:** notifications; reports
- **Depends on:** M1, M2, Approvals engine. **Required by:** Reports.
- **Tests:** concurrent double check-in (partial unique index); timezone boundaries; team scope; correction approval transaction. **AC:** one open session guaranteed at DB level; history visible per scope.

## M4 · Leave Management
- **Purpose:** apply, approve, balances, holiday calendar, policies [C T§1.1]
- **Roles:** Staff apply; Team Lead approve team; HR policies/approve; Admin
- **Pages [R]:** Apply leave, My Leave & balance, Team leave calendar, Approvals inbox (leave), Leave policies, Holiday calendar, Balances admin
- **Functional reqs:** `POST /leave-requests` with date validation [C]; approve/reject [C]; balance per employee per year; approval updates balance **and** state atomically [C]; holiday calendar [C]
- **Rules:** end ≥ start; overlap check; sufficient balance; holidays/weekends excluded from day count [R]; no self-approval [R D-12]; state machine Applied → Pending → Approved/Rejected → Cancelled [C; semantics D-12]
- **APIs:** `POST /leave-requests` [C]; `GET /leave-requests`, `GET /leave-requests/me`, `POST /leave-requests/{id}/cancel`, `GET /leave-balances/me`, `GET/POST /holidays`, `GET/PUT /leave-policies` [R]; approve/reject `/approvals/{id}/approve|reject` [C/R]
- **Tables:** `leave_requests` [C F2]; `leave_types`, `leave_balances`, `holidays`, `leave_policies` [R D-12]
- **Integrations:** email notifications [C T§5.2]
- **Depends on:** M1, M2, Approvals engine, Notifications. **Required by:** Reports, attendance (leave days vs attendance).
- **Tests:** transaction atomicity (force failure mid-approval); overlap; balance edge cases; scope; state transition table. **AC:** balance never negative, never double-deducted.

## M4a · Approvals (cross-cutting)
- **Purpose:** common approve/reject inbox for leave and attendance correction (and expenses) [C T§5.1]
- **Roles:** Team Lead (team), HR Manager [C]
- **APIs:** `POST /approvals/{id}/approve` [C]; `POST /approvals/{id}/reject`, `GET /approvals?status=` [R]
- **Tables:** `approvals` (type, subject_id, requester, approver_role/scope, status, decided_by, comment, decided_at) [R]
- **Rule:** decision applies subject-module effect in one transaction; owner = Developer 2.

## M5 · Projects & Tasks
- **Purpose:** task assignment, status updates, priority tracking, team collaboration boards [C T§1.1]
- **Roles:** Team Lead assigns/manages team tasks; Staff updates own tasks
- **Pages [R]:** My Tasks (board/list), Team Board, Task detail (comments, attachments), Projects list/detail
- **Functional reqs:** assign, track, comment, attach, deadlines and priorities, reports [C F1]
- **Rules:** lifecycle To Do → In Progress → In Review → Completed + Blocked [C]; transition table and who may complete [R D-14]; `assigned_to` must be within assigner's scope
- **APIs [R, none specified]:** `GET/POST /projects`, `GET/POST /tasks`, `GET/PUT /tasks/{id}`, `POST /tasks/{id}/status`, `POST /tasks/{id}/comments`, `POST /tasks/{id}/attachments`
- **Tables:** `tasks` [C F2]; `projects`, `project_members`, `task_comments`, `task_attachments` [R D-14, G-05]
- **Depends on:** M1, M2 (team scope), storage adapter (attachments), notifications. **Required by:** Reports.
- **Tests:** transition validity; assignment scope; board filters; attachment ACL. **AC:** illegal transitions rejected with 422 and audit.

## M6 · Meetings & Expenses
- **Purpose:** meeting agendas/minutes; expense claims with receipt uploads on Cantobo [C T§1.1]
- **Roles:** meetings: organizer/attendees (all roles ◐); expenses: Staff submit, approvers ◐ (D-17)
- **Pages [R]:** Meetings calendar/list, Meeting detail (agenda, minutes, invitees), Expense claims list, New claim (receipt upload), Expense approvals
- **Functional reqs:** schedule, invite, agenda, minutes [C F2 `invite/addAgenda/addMinutes`]; submit/approve/reject expense [C F2]; receipt upload [C]; calendar sync [C T§5.2, optional]
- **Rules:** receipt type/size limits, private storage, signed link access; amount > 0, currency single (D-17); only owner/approver can view
- **APIs [R]:** `GET/POST /meetings`, `GET/PUT /meetings/{id}`, `POST /meetings/{id}/agenda|minutes|invitees`; `GET/POST /expense-claims`, `POST /expense-claims/{id}/receipt`, approve/reject via approvals
- **Tables:** `meetings`, `expense_claims` [C F2]; `meeting_attendees`, `meeting_notes`, `expense_categories` [R D-17/18]
- **Integrations:** Google Calendar/Outlook [C F1, optional D-18]; Cantobo storage
- **Depends on:** M1, M2, M4a, storage adapter, notifications.

## M7 · Notifications
- **Purpose:** in-app updates, transactional email, scheduled reminders [C T§1.1]
- **Roles:** all (own inbox); Admin announcements [C F1 "system announcements"]
- **Pages [R]:** Notification bell/inbox, preferences (◐), announcements admin
- **Functional reqs:** email alerts, in-app, task reminders, leave/attendance alerts, announcements [C F1]
- **Rules:** send after commit (outbox); retry with backoff; never include sensitive data in email; user sees only own [R]
- **APIs [R]:** `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`, `POST /announcements`
- **Tables:** `notifications`, `notification_outbox`, `email_templates`, `reminder_jobs` [R D-15]
- **Integrations:** SMTP/SendGrid [C]; SMS optional [C F1]; Redis queue [C F1 "notifications queue"]
- **Depends on:** Foundation. **Required by:** M2–M6.

## M8 · Reports & Admin
- **Purpose:** role-based exports (CSV/PDF), company settings, backup management [C T§1.1]
- **Roles:** Admin, HR (`GET /reports/{name}`) [C]; Team Lead team reports [C T§2]; Admin settings/backup
- **Pages [R]:** Reports catalog and filters, report preview/download, Company Settings, Policy settings, Integrations, Security settings, Backup status
- **Functional reqs:** employee, attendance, leave, task/project reports; export PDF + CSV (Excel in F1, D-08); role-based access [C F1]
- **Rules:** scope applied inside report query; export audited; large exports async [R]
- **APIs:** `GET /reports/{name}` [C]; `GET/PUT /settings`, `GET /backups`, `POST /backups` [R]
- **Tables:** `company_settings`, `report_exports` (optional) [R]
- **Integrations:** payroll export (optional) [C F1]
- **Depends on:** M2, M3, M4, M5 data; Foundation. Phase 6.

---

## Cross-module shared services [R]
| Service | Owner | Consumers |
|---|---|---|
| Auth + sessions | TL | all |
| RBAC + scope resolver | TL | all |
| Audit logger | TL | all |
| Notification outbox + email adapter | TL (infra) / Dev 2 (templates, inbox) | M2–M6 |
| Storage adapter (Cantobo, signed links) | TL | M2, M5, M6 |
| Approvals engine | Dev 2 | M3, M4, M6 |
| Report framework + exporters | TL | M8 |
