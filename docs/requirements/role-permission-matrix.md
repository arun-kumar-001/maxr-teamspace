# Role Permission Matrix and Role Views

**Status:** Draft for TL review. **Legend:** ✔ = confirmed in report (T§ text / F2 figure) · ◐ = recommended, needs approval · ✖ = denied by default · scope tags `own`, `team`, `hr`, `all`.
**Non-negotiable [CONFIRMED T§2]:** every API request is authenticated and authorized by role **and** record scope on the server. Frontend visibility is cosmetic only.

## 1. Scope definitions
| Scope | Meaning | Status |
|---|---|---|
| `own` | Rows whose `employee_id` = caller's employee | ✔ (Staff "own records only") |
| `team` | Employees whose `manager_id` = caller (direct reports) | ◐ D-11 (report says "assigned team members") |
| `hr` | All employee/HR data, excluding system security settings | ◐ D-11 |
| `all` | Company-wide incl. security, config, audit | ✔ (Admin company-wide) |

Enforcement: scope filter is added **inside the repository query** (never post-fetch). Out-of-scope single-record reads return 404 (no existence leak) ◐.

## 2. Permission matrix by module and action

| Module / action | Admin | HR Manager | Team Lead | Staff |
|---|---|---|---|---|
| **Auth** login / logout | ✔ | ✔ | ✔ | ✔ |
| **Users & roles** create/deactivate user accounts | ✔ all | ◐ only via employee create/deactivate | ✖ | ✖ |
| assign role to user | ✔ | ◐ at employee creation (F2 activity diagram) | ✖ | ✖ |
| edit roles / permission catalog | ◐ (view-only if D-21 fixed roles) | ✖ | ✖ | ✖ |
| view audit logs | ✔ | ✖ (◐ HR-scope events) | ✖ | ✖ |
| **Employees** create | ✔ | ✔ | ✖ | ✖ |
| list / search | ✔ all | ✔ hr | ✔ team (F2) | ✖ (◐ limited directory: name, dept, designation) |
| view detail | ✔ | ✔ | ✔ team | ✔ own |
| update | ✔ | ✔ limited fields (F2) | ✖ | ✔ own, allowed fields only |
| deactivate (ends sessions) | ✔ | ◐ only if delegated (F2) | ✖ | ✖ |
| view/upload employee documents | ✔ | ✔ | ✖ | ◐ own list only |
| sensitive fields (ID docs, bank, compensation) | explicit permission required ✔ T§2.1 for all roles | | | |
| **Departments / designations** list | ✔ | ✔ | ◐ read | ◐ read |
| create/update/deactivate | ◐ | ◐ | ✖ | ✖ |
| **Onboarding** run checklist steps | ✔ (IT/Admin step ◐) | ✔ (HR step) | ✖ | ✔ (Employee step) |
| **Attendance** check-in/out | ✔ own | ✔ own | ✔ own | ✔ own |
| view own history | ✔ | ✔ | ✔ | ✔ |
| view others | ✔ all | ◐ hr | ✔ team ("reviews attendance") | ✖ |
| request correction | ◐ | ◐ | ◐ | ✔ own (F: "correction requests with approvals") |
| approve/reject correction | ◐ | ✔ | ✔ team | ✖ |
| manage attendance policies / shifts | ◐ | ✔ ("leave/attendance policies") | ✖ | ✖ |
| **Leave** apply | ◐ | ◐ | ◐ | ✔ own |
| view own requests/balance | ✔ | ✔ | ✔ | ✔ |
| view others | ✔ | ◐ hr | ✔ team | ✖ |
| approve / reject | ◐ | ✔ | ✔ team | ✖ (no self-approval ◐ D-12) |
| cancel | ◐ | ◐ | ◐ | ◐ own, state-dependent |
| manage leave policies, holidays | ◐ | ✔ policies | ✖ | ✖ (read holidays) |
| **Tasks / projects** create/assign | ◐ | ◐ | ✔ team | ✖ |
| update status of assigned task | ◐ | ◐ | ✔ team | ✔ own assigned |
| view | ✔ | ◐ | ✔ team | ✔ own |
| **Meetings** schedule | ◐ | ◐ | ◐ | ◐ own meetings; attend/read |
| **Expenses** submit (+receipt) | ◐ | ◐ | ◐ | ◐ own |
| approve | ◐ | ◐ | ◐ team | ✖ |
| **Notifications** read/mark own | ✔ | ✔ | ✔ | ✔ |
| announcements (system) | ✔ | ◐ | ✖ | ✖ |
| **Reports** HR/attendance/workforce | ✔ `GET /reports/{name}` | ✔ | ✔ team reports (T§2) | ✖ |
| export CSV/PDF | ✔ | ✔ | ◐ team | ✖ |
| view own payslips | ✔ own | ✔ own | ✔ own | ✔ own (read-only, D-16) |
| **Company settings**, backup | ✔ | ✖ | ✖ | ✖ |

Approve endpoint `POST /approvals/{id}/approve` is allowed for Team Lead and HR Manager only [T§5.1]; Admin approval is ◐.

## 3. Shared modules: how behavior differs by role

| Module | Staff | Team Lead | HR Manager | Admin |
|---|---|---|---|---|
| Employees | `/me` view/edit allowed fields | team list/detail read-only | full HR fields, create | all + deactivate + roles |
| Attendance | own session, own history, corrections | team grid, approve corrections | policies, all history ◐ | all |
| Leave | apply, balance, cancel | approve team, team calendar | policies, balances admin, approve | all |
| Tasks | my tasks board | team board + assign | read ◐ | read ◐ |
| Reports | none (payslips only) | team scope | HR + attendance + workforce | all |
| Notifications | own | own | own | own + announcements |

## 4. Role views (4 views in one app shell) [RECOMMENDED unless cited]

### 4.1 Admin (Super Admin / Founder) — scope `all`
- **Dashboard:** headcount, active/inactive, pending approvals overview, attendance today, recent audit events, system status.
- **Navigation:** Dashboard · Employees · Users & Roles · Departments/Designations · Attendance · Leave · Projects/Tasks · Meetings · Expenses · Reports · Notifications · Settings · Audit Logs.
- **APIs:** all in §5 of `module-inventory.md`; backend checks `role=admin`.
- **Entities:** all tables. **Audit:** every write, role change, deactivation, export, login failures.
- **States:** forbidden page for none (full access) but still handles empty/error/loading.

### 4.2 HR Manager — scope `hr`
- **Dashboard:** new joiners, onboarding in progress, leaves today, pending approvals (HR-level), attendance exceptions.
- **Navigation:** Dashboard · Employee Directory · Onboarding/Offboarding · Departments/Designations · Attendance (policies, corrections) · Leave (policies, balances, holidays) · Reports · Notifications · My Profile / My Leave / My Attendance.
- **Cannot:** edit roles/permissions catalog, security/company settings, backups, audit logs (◐).
- **Validation:** unique employee code, valid department/designation/manager, no manager cycles. **Audit:** employee create/update/deactivate, policy changes, exports.

### 4.3 Team Lead / Team Manager — scope `team`
- **Dashboard:** team attendance today, pending leave/correction approvals, team tasks by status, upcoming meetings.
- **Navigation:** Dashboard · My Team (read) · Attendance (team) · Approvals · Tasks/Projects · Meetings · Reports (team) · Notifications · My Profile / Leave / Attendance.
- **Rule:** never sees employees/approvals outside assigned team [T§2.1]. **Cannot** create/edit/deactivate employees, view sensitive fields, run company reports.
- **Audit:** approvals/rejections with comment, task assignment.

### 4.4 Staff / Employee — scope `own`
- **Dashboard:** check-in/out, leave balance, my tasks, upcoming meetings, notifications.
- **Navigation:** Dashboard · My Profile · Attendance · Leave · My Tasks · Meetings · Expenses · Payslips · Notifications.
- **Edit:** own profile allowed fields only (validated list, never role, manager, code, status).
- **Audit:** profile changes, leave submit/cancel.

## 5. Mandatory UI states for every page
Loading (skeleton), empty (with next action), error (retry + request id), **access denied** (403 page; do not reveal data), validation error (inline), submitting, success toast, offline/timeout. Frontend route guard hides links; backend still returns 401/403/404.

## 6. Required tests per role (apply to every module)
1. Unauthenticated → 401 on every endpoint.
2. For each role × endpoint: allowed → 2xx with correct scoped data; denied → 403/404.
3. Cross-scope: Team Lead A cannot read/approve Team B; Staff cannot read another Staff's attendance/leave/profile/documents (IDOR tests with swapped IDs).
4. Mass-assignment: Staff `PUT /employees/me` with `role`, `manager_id`, `employee_code`, `status` is rejected/ignored.
5. Deactivated user's token/session rejected immediately.
6. Audit row written for each sensitive action.
7. UI: nav items match role; direct URL to a forbidden route shows access-denied.

## 7. Acceptance criteria (role model)
- A single permission catalog (`module.action[.scope]`) exists and every route declares its required permission; a CI test fails if a route has none.
- Seeded users for all four roles allow the above matrix to be verified automatically.
- Any ◐ cell is resolved by TL before the owning issue starts.
