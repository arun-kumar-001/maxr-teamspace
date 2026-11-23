# Implementation Dependencies

**Status:** Draft for TL review. [R] = recommended unless noted. Companion to `module-inventory.md`.

## 1. Module dependency graph

```
Foundation (TL-01..TL-12)
   │
   ├─► M1 Auth/Users/Roles ─────────────────────────────┐
   │        │                                            │
   │        ▼                                            │
   ├─► M2 Employees/Departments/Designations ──► team scope (manager_id)
   │        │        │                                   │
   │        │        └─► Documents (needs Storage adapter)
   │        ▼
   ├─► M4a Approvals engine ──► M3 Attendance ─┐
   │        │                   M4 Leave ──────┤
   │        │                   M6 Expenses ◄──┘ (late)
   │        ▼
   ├─► M7 Notifications (infra first, consumers later)
   ├─► M5 Projects & Tasks ─► M6 Meetings ─► calendar sync (optional, last)
   └─► M8 Reports/Admin  (needs data from M2–M5, M6)
```

Critical path: **Foundation → M1 → M2 (employees + manager_id) → Approvals → Attendance/Leave → Reports → Hardening/Launch.**

## 2. Hard dependencies (cannot start before)
| Work | Requires |
|---|---|
| Any module API | TL-04 DB base, TL-05 auth, TL-06 RBAC/scope, TL-07 API conventions |
| Any UI page | TL-08 tokens, TL-09 shared UI, TL-10 app shell |
| Employee create (D1-03) | TL-04 (users/roles/employees tables), TL-11 notification adapter |
| Team-scoped endpoints (attendance, leave, tasks) | TL-06 scope resolver + D1-06 hierarchy data model (migration exists from TL-04) |
| Documents (D1-08), expense receipts, task attachments | TL-11 storage adapter, D-10 decision |
| Leave/attendance approvals (D2-05+) | Approvals engine D2-05; employees seed from TL-04 |
| Expenses (D1-12) | D2-05 approvals engine merged |
| Reports | Attendance, leave, task, employee tables populated; TL report framework |
| Calendar sync | Meetings + OAuth app credentials (D-18) |
| Payslips | D-16 data source decision |

## 3. What can run in parallel
After Foundation merges to `main`:
- **Dev 1:** departments/designations, directory, create/update, profile, hierarchy, onboarding, documents.
- **Dev 2:** attendance check-in/out, leave policies/balances, tasks/projects — none of these need Dev 1's UI, only the `employees` table and the scope resolver delivered by TL.
- **Dev 2's approvals/leave approval** waits for D2-05 only (own work).
- **TL:** reports framework, hardening, security review and integration review in parallel.

Before Foundation completes, developers may: set up local env, read docs, produce detailed task/test plans, build isolated UI prototypes inside their own feature folders **without** touching shared files.

## 4. API → table dependency map [C endpoints; R others]
| Endpoint group | Reads | Writes |
|---|---|---|
| `POST /auth/login` | users, user_roles, roles | sessions, audit_logs, login_attempts |
| `/employees*` | employees, departments, designations, users | employees, users, user_roles, audit_logs, onboarding_*, notifications |
| `/employees/{id}/deactivate` | employees, users | employees, users, sessions (revoke), audit_logs |
| `/employees/{id}/documents` | employee_documents, files | employee_documents, files |
| `/attendance/*` | attendance, employees, shifts | attendance, attendance_corrections, approvals |
| `/leave-requests*` | leave_requests, leave_balances, holidays | leave_requests, leave_balances, approvals, notifications |
| `/approvals/{id}/approve` | approvals + subject table | subject table, approvals, notifications, audit_logs |
| `/tasks*`, `/projects*` | tasks, projects, employees | tasks, task_comments, notifications |
| `/meetings*` | meetings, meeting_attendees | meetings, notifications |
| `/expense-claims*` | expense_claims | expense_claims, approvals, files |
| `/reports/{name}` | any (read-only) | report_exports, audit_logs |
| `/settings`, `/backups` | company_settings | company_settings, audit_logs |

## 5. File ownership (avoid collisions) [R]
| Area | Owner | Others may |
|---|---|---|
| `AGENTS.md`, `docs/architecture`, `docs/security`, `.github/**`, root configs, Docker/Nginx | TL | request via issue |
| `packages/shared/**`, auth, RBAC, audit, API helpers | TL | import only |
| Design tokens, `components/ui/**`, app shell, routing, nav registry | TL | register routes/nav items via the module's own `nav.ts`/`routes.ts` |
| `apps/api/src/modules/{departments,designations,employees,onboarding,documents,users,expenses,settings}` + web `features/*` equivalents | Dev 1 | — |
| `apps/api/src/modules/{attendance,leave,approvals,notifications(templates),projects,tasks,meetings}` + web equivalents | Dev 2 | — |
| `apps/api/src/modules/reports` framework | TL | Dev 1/2 add report definitions in their own module (`reports.ts`) |
| Migrations | Each owner in their own tables; shared tables (`users`, `roles`, `employees`, `departments`) → TL/Dev 1 only | Dev 2 requests changes |

Migration collision rule: timestamp-prefixed files, one migration per PR, rebase/merge `main` before generating; shared-table changes go through TL.

## 6. Shared business workflows — single owner
| Workflow | Owner | Consumers (read/emit only) |
|---|---|---|
| Employee lifecycle (create/onboard/deactivate) | Dev 1 | Dev 2 reads employee status |
| Approvals engine | Dev 2 | Dev 1 expenses (later) |
| Notification delivery | TL (infra) | all emit events through the interface |
| Team scope resolution | TL | all |

## 7. Integration order [R]
1. Email (SMTP dev sink → SendGrid) · 2. Cantobo storage adapter (local-disk fake first) · 3. Redis sessions/cache · 4. Calendar sync · 5. SMS · 6. Payroll export. Each behind an interface with a fake for tests.

## 8. Merge/integration flow [R]
`feature/employee-management` and `feature/attendance-collaboration` each merge **from** `main` regularly; TL integrates through PRs into `main` after review and CI; `feature/global-setup` lands first. No developer edits another's module folder.
