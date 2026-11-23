# MAXR Teamspace — Product Baseline

**Status:** Draft for Technical Lead review · **Source:** *MAXR ONE Staff Management HLD/LLD Specification v1.0 (Approved Baseline)*, 6 pages incl. Figure 1 (HLD) and Figure 2 (LLD) · **Repo evidence:** see `docs/project-planning/repository-gap-analysis.md`

**Labels used in all planning docs**

| Label | Meaning |
|---|---|
| **[CONFIRMED]** | Stated in the approved report (text or diagram). Cited as `T§` (report text section) or `F1`/`F2` (figure). |
| **[RECOMMENDED]** | Architect proposal to fill a gap. Needs TL approval. Not a requirement. |
| **[ASSUMED]** | Working assumption so planning can proceed. Must be confirmed. |
| **[DECISION D-nn]** | Open question; see §10 register. |

Report precedence used when sources disagree: **report text > figures > recommendation.** Conflicts are logged, never silently resolved (see `docs/architecture/diagram-gap-analysis.md`).

---

## 1. Product purpose and scope

MAXR ONE Staff Management Module (repo name `maxr-teamspace`): a central web platform for daily workforce management, employee profiles and operational approvals, with staff self-service and admin control for team leads and HR. [CONFIRMED T§1]

### 1.1 In scope — 8 business modules [CONFIRMED T§1.1]
1. User & Role Management  2. Employee Directory  3. Attendance & Shifts  4. Leave Management  5. Projects & Tasks  6. Meetings & Expenses  7. Notifications  8. Reports & Admin

> Figure 1 decomposes modules differently (8 boxes, no "Meetings & Expenses", adds "System Configuration" and "Reports & Analytics"). Text list is used as the scope baseline; see gap G-06.

### 1.2 Out of scope — must not become mandatory work [CONFIRMED T§1.2]
- Sales CRM (leads, pipelines, deal revenue) — separate external CRM.
- Direct payroll processing (tax calc, bank disbursement). Module only supplies certified attendance/leave summaries and **read-only payslips**.
- Speculative employee fields not provided by the business owner.
- Optional per Figure 1 (not in text scope): mobile app, SMS, payroll export, calendar sync → treated as **optional/late**, see D-07, D-15, D-18.

## 2. Roles (summary — full matrix in `role-permission-matrix.md`)

| Report text | Figure / TL brief | Scope [CONFIRMED T§2] |
|---|---|---|
| Admin | Super Admin / Founder | Company-wide |
| HR Manager | HR Manager | HR scope |
| Team Lead | Team Manager | Team scope |
| Staff / Employee | Staff / Employee | Own records only |

Naming differs between text and figure → D-01. Rule: **access denied by default; the server verifies authentication token and record ownership on every query; hiding UI is not security.** [CONFIRMED T§2]

## 3. Confirmed architecture baseline [CONFIRMED T§3, F1]
- Web app: React + TypeScript, responsive desktop/mobile web. (Figure says "React / Next.js" → D-03.)
- Nginx gateway: TLS termination, rate limiting, forwards `/api/v1/*`.
- Node.js modular backend: Auth, Employees, Attendance, Leave, Tasks, Notifications (+ others per modules).
- PostgreSQL 16 primary data; Redis temporary caching; Cantobo Server encrypted private file storage (receipts, employee documents).
- Integrations: SMTP/SendGrid email, SMS, calendar sync, payroll export tools.
- Deployment: GitHub Actions builds and deploys Docker containers to Cantobo Server.

## 4. Core domain rules [CONFIRMED T§4.1]
| Rule | Notes |
|---|---|
| Employee is the central model: unique employee code, personal info, department, designation, manager link | |
| User & permissions connect login credentials to roles and feature permissions | |
| Attendance: **only one open session per employee** | Enforce in DB (partial unique index) [RECOMMENDED] |
| Leave balances per employee per year; **approval updates balance and request state in a single transaction** | |
| Document storage: metadata in DB, encrypted file on Cantobo | |
| Deactivation ends active login sessions (T§5.1) | Affects auth design (D-05) |

## 5. Workflow / state-machine inventory

| Workflow | Confirmed states | Gaps |
|---|---|---|
| Leave request | Applied → Pending → Approved / Rejected → Cancelled [T§4.1] | Difference between Applied and Pending; who may cancel and from which states; D-12 |
| Task | To Do → In Progress → In Review → Completed, plus Blocked [T§4.1] | Allowed transitions, who may move to Completed; D-14 |
| Onboarding | 4 steps HR → System → IT/Admin → Employee; account activates after all checklist items verified [T§4.1] | Figure 2 activity diagram instead creates account and sends notification immediately (G-11); checklist items undefined; D-20 |
| Attendance correction | Request + approval by Team Lead / HR Manager [T§1.1, T§5.1] | States and fields undefined; D-13 |
| Expense claim | `status` column exists in ER [F2] | States and approver undefined; D-17 |
| Employee status | `status`/`employment_status` columns exist [F2] | Values undefined |
| Offboarding | Named in T§1.1 and T§5.2 | No workflow defined; D-19 |
| Create employee (HR) | Sequence: permission check → validate → insert employee → create user → commit → onboarding email [F2] | Reconcile with 4-step onboarding |

## 6. Data entities (from Figure 2 ER) [CONFIRMED]
`departments`, `designations`, `employees`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `attendance`, `leave_requests`, `tasks`, `meetings`, `expense_claims`, `employee_documents`. Attributes and relationships: `docs/architecture/module-inventory.md`. Missing tables required by confirmed behavior: `docs/architecture/diagram-gap-analysis.md` G-03.

## 7. API baseline [CONFIRMED T§5.1, F2§7]
Base path `/api/v1` (figure shows `/api`; D-06). Text endpoints: `POST /auth/login`, `GET /employees/me`, `GET,POST /employees`, `GET,PUT /employees/{id}`, `POST /employees/{id}/deactivate`, `POST /attendance/check-in|check-out`, `POST /leave-requests`, `POST /approvals/{id}/approve`, `GET /reports/{name}`. Figure adds `PUT /employees/me`, `DELETE /employees/{id}`, `GET /departments`, `GET /designations`, `GET /employees/{id}/documents`. Everything else (tasks, meetings, expenses, notifications, users/roles, settings, rejections, balances) is **not specified** → needs API design [RECOMMENDED] in `module-inventory.md`.

## 8. Roadmap baseline [CONFIRMED T§5.2]
P1 Foundation → P2 Employee Directory → P3 Employee Lifecycle → P4 Daily Operations (attendance, leave, approvals, email) → P5 Team Collaboration (projects/tasks, meetings + calendar sync) → P6 Expenses & Reports → P7 Testing & Launch. Mapped to owners in `docs/project-planning/development-roadmap.md`.

## 9. Required global foundation [RECOMMENDED]
Stack ADR; monorepo scaffold; Docker dev env; CI gates; DB migrations + base tables + seeds; auth/session; RBAC + record-scope engine; API conventions; design tokens + shared UI; app shell with 4 role dashboards; audit logger; notification and storage adapters; developer setup docs; PR workflow. Detailed issues `TL-01…TL-12` in `developer-work-breakdown.md`.

## 10. Decision register (needs Technical Lead approval)

| ID | Decision | Conflict / gap | Recommendation |
|---|---|---|---|
| D-01 | Role names | Admin vs Super Admin/Founder; Team Lead vs Team Manager | Code names `admin`, `hr_manager`, `team_lead`, `staff`; UI labels per TL |
| D-02 | Architecture style | Text: "modular microservices" and "modular, layered"; F1: "Modular Services" | Modular monolith, one deployable, strict module boundaries (ADR) |
| D-03 | Frontend framework | Text: React+TS; F1: React/Next.js | React+TS SPA; no SSR need (internal app) |
| D-04 | Database | Text: PostgreSQL 16; F1: PostgreSQL/MySQL | PostgreSQL 16 only |
| D-05 | Auth mechanism | F1: JWT/OAuth2; text: "secure session token"; deactivation must end sessions | Server-side sessions in Redis via httpOnly cookie, or short JWT + revocable refresh; no OAuth2 for MVP |
| D-06 | API contract | `/api/v1` vs `/api`; `POST …/deactivate` vs `DELETE`; `PUT /employees/me` | Text version: `/api/v1`, `POST /deactivate`; keep `PUT /employees/me` |
| D-07 | Mobile app | F1 optional | Out of MVP; responsive web only |
| D-08 | Export formats | Text CSV/PDF; F1 PDF/Excel | CSV + PDF; Excel only if requested |
| D-09 | CI/CD | Text GitHub Actions; F1 GitHub Actions / GitLab CI | GitHub Actions |
| D-10 | Cantobo Server | Storage API, on-prem vs hosted, backup, signed-link mechanism unspecified | Ask infra owner; storage adapter interface hides it. Questions to ask are in `docs/architecture/shared-services.md` §8 |
| D-11 | Team and scope model | "Team scope", "HR scope" undefined; reporting hierarchy `manager_id` only | Team = direct reports via `manager_id` (non-recursive); HR = all employees; confirm |
| D-12 | Leave workflow | Applied vs Pending; cancel rules; Team Lead's/HR's own leave approver | Define transition table and no-self-approval rule |
| D-13 | Attendance & shifts | No shift table; location semantics; late/overtime; timezone; correction fields | Add `shifts`, `attendance_corrections`; company timezone setting |
| D-14 | Projects model | Text "Projects & Tasks"; ER has `tasks` but no `projects`/teams | Add `projects`, `project_members` |
| D-15 | Notifications | Persistence, templates, reminders scheduler, SMS/OTP undefined | `notifications` table + outbox; email + in-app MVP; SMS later |
| D-16 | Payslips | "Read-only payslips" but payroll out of scope — data source? | Import from external payroll export; late and optional |
| D-17 | Expense workflow | States, approver, categories, currency | Staff → Team Lead → HR; confirm |
| D-18 | Meetings & calendar sync | Invite flow, minutes storage, Google/Outlook | Core meetings in P5; sync late/optional |
| D-19 | Offboarding | Named, never defined | Mirror onboarding checklist; define items |
| D-20 | Onboarding checklist | Items and per-step owners (IT/Admin role?) | Define items; IT step owned by Admin |
| D-21 | RBAC style | `permissions(module, action, scope)` implies data-driven | Seeded permission catalog; roles fixed at 4 in MVP; admin edits assignments only |
| D-22 | Missing inputs | `AGENTS_UNIVERSAL.md` not supplied; MAXR Flow palette **now supplied** (product screenshot, sampled per pixel into `docs/design/DESIGN.md`) | Still needed: `AGENTS_UNIVERSAL.md`, official logo files, confirmed font names |
| D-23 | HR delegated deactivation | Figure: "Super Admin (HR Manager if delegated)" | Model as explicit permission `employee.deactivate` grantable to HR |
| D-24 | Expense and task owner assignment between developers | Brief assigns Dev 2 attendance→collaboration; expenses/reports unassigned | Expenses + company settings → Dev 1 (after P3); reports framework → TL |
| D-25 | Data protection / retention | PII, ID docs, bank data; no policy stated | TL to confirm legal basis and retention before P3 |

## 11. Out-of-document items that are NOT requirements
Everything labelled [RECOMMENDED] or [ASSUMED] in the planning docs is a proposal. Only [CONFIRMED] items are product requirements.
