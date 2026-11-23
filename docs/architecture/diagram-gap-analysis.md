# HLD / LLD Diagram Gap Analysis

**Status:** Draft for TL review · **Inspected:** Figure 1 (HLD, report p.4) and Figure 2 (LLD, report p.5: UML class diagram, ER diagram, 3 sequence diagrams, onboarding activity diagram, REST endpoint table) against report text T§1–5.
**Approach:** no diagram is redrawn. Each gap lists the evidence, impact and recommended update. **No architectural change is applied without TL approval.** Figure 2's endpoint table is a low-resolution raster; endpoint text was read at enlarged scale and a few cells are only partly legible — request a vector source.

Severity: **H** blocks implementation or causes rework · **M** needs a decision before the owning module starts · **L** cosmetic.

## A. Overall verdict
| Artifact | Covers requirements? | Verdict |
|---|---|---|
| HLD (Fig. 1) | Layers, 8 modules, integrations, data flow, deployment shown | Adequate as direction; contradicts text in stack details (G-02, G-06) |
| Class diagram | 9 domain classes + RBAC classes | Good for Employee/RBAC; thin for Leave, Attendance, Tasks, Expenses, Meetings (no states/enums) |
| ER diagram | 14 tables | **Insufficient** — missing ~15 tables needed by confirmed behavior (G-03) |
| Sequence diagrams | 3 flows (create employee, view profile, update own profile) | Insufficient; covers Employees only (G-10) |
| Onboarding activity | 1 flow | Conflicts with the text's 4-step onboarding (G-11) |
| API table | 10 employee-related endpoints | Insufficient; 90% of API surface unspecified (G-13) |

## B. Gap list

| ID | Sev | Type | Finding (evidence) | Recommended update | TL approval? |
|---|---|---|---|---|---|
| G-01 | M | Inconsistent | Roles: text "Admin", "Team Lead"; figures and TL brief "Super Admin/Founder", "Team Manager". Matrix labels also differ. | Pick canonical names (D-01) and use one set in code/UI/docs | Yes |
| G-02 | H | Inconsistent | Text: React+TS, PostgreSQL 16, "secure session token", GitHub Actions, "modular microservices". F1: React/Next.js, PostgreSQL/MySQL, JWT/OAuth2, GitHub Actions/GitLab CI, "Modular Services". | ADR choosing text version unless TL says otherwise (D-02..D-05, D-09) | Yes |
| G-03 | H | Missing | ER lacks tables required by confirmed behavior: `shifts`, `attendance_corrections`, `leave_types`, `leave_balances`, `holidays`, `approvals`, `notifications`, `audit_logs`, `sessions`/refresh tokens, onboarding checklist tables, `files` metadata, `projects`, `project_members`, `task_comments/attachments`, `meeting_attendees/notes`, `company_settings`, `expense_categories`. | Add to the ER (`module-inventory.md` lists proposed tables) before each owning module starts | Yes (shared tables) |
| G-04 | M | Ambiguous | `employees` — `users` relation drawn optional/many; text implies one login per employee ("account activates after onboarding"). Founder/Admin may have no employee row? | Define `users.employee_id` unique FK (1:1) and whether system accounts exist | Yes |
| G-05 | M | Missing | `tasks` has no `project_id`, team or visibility; text promises projects and team boards. | Add `projects`, `project_id`, membership (D-14) | Yes |
| G-06 | M | Inconsistent | F1 module decomposition omits "Meetings & Expenses" and adds "System Configuration"; text lists Meetings & Expenses and "Reports & Admin". ER/class diagram do include meetings and expenses. | Treat text list as scope (M1–M8); update F1 box 8/7 | No (document) |
| G-07 | H | Incomplete | `attendance` lacks work date, timezone, source, shift link; "one open session per employee" is a text rule but no constraint is shown. | Partial unique index on `(employee_id) WHERE check_out IS NULL`; add `work_date`, `shift_id` | Yes |
| G-08 | H | Incomplete | `leave_requests` has free-text `leave_type`, no `days`, half-day, rejection reason, decided_at; balances table absent though approval must update balance atomically. | Add `leave_types`, `leave_balances(employee_id, year, type, entitled, used)`, decision fields | Yes |
| G-09 | M | Ambiguous | All `status` fields are `String`; state sets defined only in text (leave, task) or not at all (attendance, expense, employee, meeting). | Define enums + transition tables in the ER/class notes | Yes |
| G-10 | H | Missing | Only 3 sequence diagrams, all Employees. None for login, check-in/out, leave apply+approve, approvals, deactivation + session revoke, document upload, expense claim, task transition. | Add compact sequence diagrams for these 8 flows (text-based Mermaid is enough) | No |
| G-11 | H | Inconsistent | Text: onboarding is 4 steps HR → System → IT/Admin → Employee; account activates after all items verified. F2 activity diagram and sequence 3: create employee → create user account → send onboarding email (no checklist, no activation gate). | Reconcile: create employee + user in `pending` state; activate on checklist completion (D-20) | Yes |
| G-12 | L | Ambiguous | Activity diagram decision nodes "Valid?" and "Exists?" — failure/duplicate branches have no drawn end state or loop-back. | Add error end states (400/409) | No |
| G-13 | H | Missing | F2 table lists only employee/department/designation endpoints; text adds auth, attendance, leave, approvals, reports. No spec for tasks, meetings, expenses, notifications, users/roles, settings, rejection, balances. Figure uses `/api` while text uses `/api/v1`; `DELETE /employees/{id}` vs text `POST /employees/{id}/deactivate`; `PUT /employees/me` only in figure. | Produce OpenAPI for the full surface (`module-inventory.md` §APIs is the starting list) | Yes (D-06) |
| G-14 | M | Inconsistent | Class diagram `Permission`–`RolePermission` multiplicity drawn `0..1` ↔ `*`; `permissions.scope` values undefined (`own/team/hr/all`?). Roles editable or fixed unclear. | Correct to `1..*`; define scope enum (D-11, D-21) | Yes |
| G-15 | M | Incomplete | Deployment box shows LB, Frontend, Backend, DB, File Storage on "On-Premise/Cantobo"; Redis, staging env, backups, secrets, monitoring absent. Text says encrypted private storage and backup drills in Phase 7. | Add Redis, staging, backup/restore, log/monitoring to deployment view (D-10) | Yes |
| G-16 | H | Missing | "Activity audit logs" required (T§1.1) but no `audit_logs`; no login-attempt/lockout, no session store. | Add `audit_logs`, `sessions`, `login_attempts` | Yes |
| G-17 | M | Missing | Notification Service appears in sequence 3 and F1 but no persistence, template or reminder-scheduler model. | Add notification + outbox + reminder job design (D-15) | Yes |
| G-18 | L | Ambiguous | Optional integrations (SMS/OTP login, payroll export/payslips, calendar sync, mobile app) have no data flow or ownership. | Mark optional/Phase 6+ and specify only when approved (D-07, D-15, D-16, D-18) | No |
| G-19 | L | Inconsistent | Figures are titled "MAXR CRM" though Sales CRM is out of scope; cover says MAXR ONE; repo says MAXR Teamspace. | Align product naming | No |
| G-20 | M | Ambiguous | `employee_documents` stores `file_path` only; text requires encrypted files, signed links, metadata; no size/type/checksum/encryption fields, no document categories or sensitivity flag. | Add `files` metadata, `document_type` enum, `is_sensitive` and access-permission rule | Yes |
| G-21 | M | Missing | `users` has no failed-login counter, MFA, password-reset token, `must_change_password` flag for newly created accounts. | Add or define in auth ADR (D-05) | Yes |
| G-22 | M | Ambiguous | Team Lead "views employee" scope and `GET /employees` allowed roles include Team Manager, but the matrix of visible fields (sensitive vs non-sensitive) is undefined. | Define field-level visibility per role (see role matrix §2) | Yes |

## C. Recommended diagram updates (only where justified)
1. ER: add the G-03/G-07/G-08/G-16 tables and enums (single consolidated update, TL approved).
2. Sequence: add 8 flows from G-10 as Mermaid under `docs/architecture/`.
3. Activity: replace onboarding diagram with the 4-step state flow (G-11).
4. API: publish an OpenAPI spec as the canonical contract (G-13).
5. HLD: footnote the decisions D-02..D-05, D-09; add Redis/staging/backup (G-15).

## D. Impact if left unresolved
G-02, G-03, G-07, G-08, G-10, G-11, G-13, G-16 will cause two developers to invent incompatible schemas and workflows. They should be resolved (or explicitly deferred) before the owning issue begins.
