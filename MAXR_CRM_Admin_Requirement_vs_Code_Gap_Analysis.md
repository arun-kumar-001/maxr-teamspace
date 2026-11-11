# MAXR CRM – Super Admin / Founder Module: Requirement vs. Existing Code Gap Analysis

**Author:** Senior Software Architect, Technical Lead & Code Auditor  
**Date:** November 4, 2026  
**Target Module:** Super Admin / Founder Module (Company-wide scope: `all`)  
**Repository:** `maxr-teamspace`  
**Reference Baseline:** *MAXR ONE Staff Management HLD/LLD Specification v1.0 (Approved Baseline)*, Product Baseline (`docs/requirements/product-baseline.md`), Role Permission Matrix (`docs/requirements/role-permission-matrix.md`), and Architecture Decisions (`docs/architecture/`).

---

## 1. Executive Summary

This audit evaluates the current implementation status of the **Super Admin / Founder module** in the `maxr-teamspace` repository against the approved requirement baseline. The Super Admin role carries company-wide record scope (`all`) and is responsible for overall governance: workforce oversight, account administration, RBAC, organizational structure, attendance and leave policy enforcement, project/task monitoring, financial claims, compliance reporting, immutable audit logging, and core system configuration.

### Key Audit Findings:
1. **Core Admin Governance is Strongly Implemented on the Backend:**
   * **Audit Logging:** Fully immutable, append-only with double-redaction, backed by database triggers that reject `UPDATE`, `DELETE`, and `TRUNCATE` (`apps/api/src/modules/audit-logs`).
   * **Company Settings:** Single-row singleton with IANA timezone validation, custom workweek, and integration toggles (`apps/api/src/modules/settings`).
   * **RBAC & Role Assignment:** Fixed 4-role architecture with transactional locks preventing the demotion of the last active administrator (`apps/api/src/modules/users`).
   * **Reporting Framework:** 7 company-wide operational reports with real-time JSON previews, streaming RFC 4180 CSV export (injection-safe), and sandboxed multi-page PDF generation via `worker_threads` (`apps/api/src/modules/reports`).
   * **Department & Designation Lifecycle:** Complete CRUD with referential constraint enforcement against active employee or title assignments (`apps/api/src/modules/employees`).
   * **Employee Deactivation:** Atomic transaction updating `deactivated_at`, terminating all active Redis sessions immediately (`apps/api/src/modules/employees/deactivation`).

2. **Critical Architectural & UX Gaps Identified in the Admin Module:**
   * **Gap 1 (P0 - Dashboard Telemetry):** The primary Admin Dashboard (`apps/web/src/dashboards/AdminDashboard.tsx`) displays **100% hardcoded sample data** with a `"Sample data"` badge. No backend aggregation endpoint exists to serve live KPI counts (total headcount, active Redis sessions, system health, security event counts).
   * **Gap 2 (P1 - Navigation Dead-Ends):** The Admin Navigation Registry (`apps/web/src/shell/navigation.tsx`) excludes Super Admin from viewing or configuring **Attendance**, **Leave Policies**, **Shift Policies**, **Tasks**, and **Approvals** in the sidebar. While the backend authorizes Admin for these APIs, the frontend navigation prevents access.
   * **Gap 3 (P1 - Direct User Account Provisioning):** User accounts can only be created as a secondary side-effect of employee creation (`POST /api/v1/employees`). There is no independent user creation route (`POST /api/v1/users`), preventing the creation of standalone admin/system accounts.
   * **Gap 4 (P2 - Payslips & Sensitive Payroll Data):** Payslip storage, upload, and retrieval are completely absent from the backend schema and APIs, leaving `/staff/payslips` unmapped.
   * **Gap 5 (P2 - Database Backup UI):** While database backup scripts and CI drills exist, there is no Admin UI or API endpoint for manual backup triggering or status verification.

---

## 2. Requirement vs. Existing Code Comparison Matrix

| No. | Requirement | Expected Functionality | Existing Implementation | Status | Gap Identified | Priority |
|:---|:---|:---|:---|:---|:---|:---|
| **1** | **Admin Dashboard & Analytics** | Real-time company KPIs: Total Headcount, Active Sessions, Attendance Today, Pending Approvals, System Health, Security Logs, Quick Actions. | `apps/web/src/dashboards/AdminDashboard.tsx` renders static mockup cards. Quick action buttons (`Add User`, `Export Audit Log`) are non-functional. | **UI Only** | Zero API connectivity. No backend KPI aggregation endpoint (`GET /api/v1/admin/dashboard`). Hardcoded sample values. | **Critical (P0)** |
| **2** | **User Account Administration** | List, search, filter, paginate, activate/deactivate user accounts, view last login timestamps, inspect session states. | `apps/api/src/modules/users/users.routes.ts`<br>`apps/web/src/features/users/pages/UsersPage.tsx` | **Implemented** | Working search, filtering, pagination, last-login tracking, and status badges. | **Low (P3)** |
| **3** | **Direct User Creation** | Super Admin directly provisions administrative or system accounts with temporary passwords. | Only created implicitly via `POST /api/v1/employees`. No `POST /api/v1/users` exists. | **Partially Implemented** | Cannot create a user without creating a full employee directory record. | **High (P1)** |
| **4** | **Role & Permission Management** | Assign roles to users. Prevent demotion of last admin. View system permissions catalog. | `PUT /api/v1/users/:id/roles`<br>`GET /api/v1/roles`<br>`GET /api/v1/permissions`<br>`apps/web/src/features/users/components/RoleAssignmentModal.tsx` | **Implemented** | Meets Decision D-21: 4 fixed roles. Last admin demotion blocked with DB row lock. Permission catalog inspectable. | **Low (P3)** |
| **5** | **Custom Role Creation** | Create dynamic custom roles and attach custom permission grants. | Catalog is hardcoded in code (`apps/api/src/modules/rbac/catalog.ts`). | **Not Implemented** | Intentional by Decision D-21 for MVP, but limits enterprise flexibility. | **Low (P3)** |
| **6** | **Employee Directory Administration** | Company-wide search, view full profiles, edit fields, filter by department/status/manager. | `GET /api/v1/employees`<br>`PUT /api/v1/employees/:id`<br>`apps/web/src/features/employees/pages/EmployeeDirectoryPage.tsx` | **Implemented** | Full company-wide scope (`all`). Multi-field search, sorting, filtering, and detail modal/page. | **Low (P3)** |
| **7** | **Employee Deactivation & Session Termination** | Deactivate employee, record `deactivated_at`, prevent future logins, terminate all active Redis sessions immediately. | `POST /api/v1/employees/:id/deactivate`<br>`apps/api/src/modules/employees/deactivation/`<br>`apps/web/src/features/employees/pages/EmployeeDeactivationPage.tsx` | **Implemented** | Super Admin only (D-23). Deactivates employee and revokes active sessions in Redis in one atomic operation. | **Low (P3)** |
| **8** | **Departments & Designations Management** | CRUD operations on departments and job titles. Enforce foreign key constraints and prevent deletion of populated entities. | `apps/api/src/modules/employees/departments/`<br>`apps/api/src/modules/employees/designations/`<br>`apps/web/src/features/departments/`<br>`apps/web/src/features/designations/` | **Implemented** | Case-insensitive code uniqueness, active state toggle, conflict prevention on active references, full UI. | **Low (P3)** |
| **9** | **Reporting Hierarchy & Org Chart** | Visualize reporting structure, prevent cyclical manager loops, reassign reports upon deactivation. | `GET /api/v1/employees/org-roots`<br>`GET /api/v1/employees/:id/reports`<br>`apps/web/src/features/employees/pages/OrgChartPage.tsx` | **Implemented** | Tree visualization, depth-first cycle detection in `detail.service.ts` preventing circular reporting structures. | **Low (P3)** |
| **10** | **Attendance Policy & Shifts Configuration** | Configure work shifts, grace period, half-day/full-day thresholds, overtime rules. | Backend: `GET,POST,PUT,DELETE /api/v1/shifts`<br>`GET,PUT /api/v1/attendance/policies`<br>Frontend: `ShiftsAndPoliciesPage.tsx` | **Backend Only** | Backend complete, but Admin is **excluded** from `hr-policies` in `navigation.tsx`. Admin cannot access from sidebar. | **High (P1)** |
| **11** | **Attendance Oversight & Corrections** | View company-wide attendance sessions, review and decide correction requests. | Backend: `GET /api/v1/attendance/records`<br>`POST /api/v1/attendance/corrections/:id/approve`<br>Frontend: `AttendancePage.tsx` | **Backend Only** | Backend supports Admin scope `all`. Admin sidebar has NO Attendance or Approvals link in `navigation.tsx`. | **High (P1)** |
| **12** | **Leave Policies & Holiday Calendar** | Define annual leave types, allotments, carry-forward days, paid flags, and holiday dates. | Backend: `/api/v1/leave-policies`, `/api/v1/holidays`<br>Frontend: `LeaveManagementPage.tsx` | **Backend Only** | Backend allows Admin; frontend sidebar has NO link for Admin to configure leave policies or holidays. | **High (P1)** |
| **13** | **Company-Wide Approvals Oversight** | Super Admin view and emergency override on all pending leave, attendance correction, and expense approvals. | Backend: `GET /api/v1/approvals`<br>`POST /api/v1/approvals/:id/approve`<br>Frontend: `ApprovalsInboxPage.tsx` | **Backend Only** | Backend grants Admin `approvals.decide` with scope `all`. Frontend sidebar only renders Approvals for `TEAM_LEAD`. | **High (P1)** |
| **14** | **Projects & Tasks Oversight** | View company projects, Kanban boards, assign tasks, track status, add comments and attachments. | Backend: `/api/v1/projects`, `/api/v1/tasks`<br>Frontend: `ProjectsListPage.tsx`, `TasksPage.tsx` | **Partially Implemented** | `/projects` is in Admin sidebar, but `/tasks` is omitted from Admin sidebar. Admin must navigate via project details. | **Medium (P2)** |
| **15** | **Expense Claims & Financial Administration** | View all employee expense claims, receipts, approve/reject, configure expense categories. | `GET,POST /api/v1/expense-categories`<br>`GET /api/v1/expense-claims`<br>`apps/web/src/features/expenses/pages/ExpensesPage.tsx` | **Implemented** | Admin has full `all` scope for claims, category creation modal, receipt download via signed private storage links. | **Low (P3)** |
| **16** | **Reports & Data Exports** | Real-time preview of 7 company reports, CSV export with formula injection protection, PDF generation via worker threads. | `apps/api/src/modules/reports/`<br>`apps/web/src/features/reports/pages/ReportsPage.tsx` | **Implemented** | Full compliance: Headcount, Joiners/Leavers, Directory, Attendance Summary, Leave Usage, Tasks, Projects. | **Low (P3)** |
| **17** | **Immutable Audit Log Viewer** | Query append-only audit trail by actor, action, module, outcome, date range. Double redaction of sensitive credentials. | `GET /api/v1/audit-logs`<br>`apps/web/src/features/audit-logs/pages/AuditLogsPage.tsx` | **Implemented** | Database trigger blocks `UPDATE`/`DELETE`/`TRUNCATE`. Filter toolbar, JSON metadata drawer, double-redaction verified. | **Low (P3)** |
| **18** | **System Notifications & Announcements** | Broadcast system-wide announcements to all employees, in-app notification center. | `POST /api/v1/notifications/announcements`<br>`apps/web/src/features/notifications/` | **Implemented** | Admin can compose announcements (`AnnouncementModal`), broadcast to all active accounts, mark as read. | **Low (P3)** |
| **19** | **Company Settings & Configuration** | Set company name, IANA timezone, work week days, integration toggles. | `GET,PUT /api/v1/settings`<br>`apps/web/src/features/settings/pages/CompanySettingsPage.tsx` | **Implemented** | Singleton row with validation, in-memory 60s cache reader for services, audit logged. | **Low (P3)** |
| **20** | **Payroll & Payslip Administration** | Provide certified summaries and read-only payslips for staff. | Reports provide summaries. Payslip backend/DB tables are completely non-existent. | **Not Implemented** | Direct payroll processing was out-of-scope, but read-only payslips were planned (D-16). No API or DB schema exists. | **High (P1)** |
| **21** | **Database Backup Management** | Trigger and verify database backups from the Admin interface. | CI/CD scripts (`scripts/drill-backup-restore.sh`), but no REST API or UI. | **Not Implemented** | Backups are managed strictly via external DevOps tooling; no in-app trigger or status telemetry. | **Medium (P2)** |

---

## 3. Detailed Gap Identification

### GAP-01: Admin Dashboard Uses Mock Data Without API Telemetry
1. **Requirement Expectation:**  
   The Super Admin Dashboard must provide a live operational command center showing real-time metrics: Total Team Members, Present Today, Pending Leave/Correction/Expense Approvals, Open Tasks, Weekly Attendance Trends, Recent Security Audits, and System Health status.
2. **Current Code Implementation:**  
   `apps/web/src/dashboards/AdminDashboard.tsx` renders hardcoded JSX with badge `<Badge variant="neutral">Sample data</Badge>`.
   ```tsx
   // apps/web/src/dashboards/AdminDashboard.tsx:35-61
   <p className="mt-2 text-2xl sm:text-3xl font-extrabold text-text font-display">128</p>
   <p className="mt-1 text-xs text-positive-ink font-medium">100% active accounts</p>
   ```
   No `useEffect`, React Query, or `fetch` call exists in `AdminDashboard.tsx`.
3. **What is Missing:**  
   * Backend aggregation endpoint: `GET /api/v1/admin/dashboard` or `GET /api/v1/analytics/overview`.
   * Service to aggregate counts across PostgreSQL tables (`employees`, `attendance_records`, `approvals`, `tasks`) and Redis active session count.
   * Frontend integration hook `useAdminDashboardTelemetry()`.
   * Action wiring for `Add User`, `Export Audit Log`, and `Create Task` buttons.
4. **Impact:**  
   High executive visibility risk. The dashboard fails to reflect real company data.
5. **Required Work:**  
   Create backend telemetry router in `apps/api/src/modules/analytics/` or `admin/`, query DB counts via lightweight SQL counters, return structured telemetry, and hook into `AdminDashboard.tsx`.
6. **Modules Affected:** `apps/api` (new analytics service), `apps/web` (`AdminDashboard.tsx`).
7. **Blocking:** None, but blocks executive adoption.
8. **Priority:** **Critical (P0)**.

---

### GAP-02: Admin Sidebar Navigation Omits Operational Modules (Attendance, Leave, Tasks, Approvals)
1. **Requirement Expectation:**  
   Super Admin has company-wide scope (`all`) and must be able to navigate to and manage Attendance, Leave Policies, Shift Configurations, Tasks, and Approvals directly from the global navigation shell.
2. **Current Code Implementation:**  
   In `apps/web/src/shell/navigation.tsx`, the `NAVIGATION_REGISTRY` restricts items as follows:
   * `hr-policies` (`/hr/policies`): `allowedRoles: [ROLES.HR_MANAGER]` (Admin omitted).
   * `lead-approvals` (`/lead/approvals`): `allowedRoles: [ROLES.TEAM_LEAD]` (Admin omitted).
   * `staff-attendance` (`/staff/attendance`): `allowedRoles: [ROLES.STAFF]` (Admin omitted).
   * `lead-tasks` (`/lead/tasks`): `allowedRoles: [ROLES.TEAM_LEAD]` (Admin omitted).
   * In `getSidebarGroupsForRole(role)`: Admin only receives `dashboard`, `admin-users`, `admin-employees`, `admin-departments`, `admin-designations`, `admin-audit`, `admin-settings`, `admin-reports`, `projects`, `meetings`, `expenses`, and `profile`.
3. **What is Missing:**  
   * Admin navigation entries for Attendance Overview (`/attendance`), Leave & Shift Policies (`/leave/policies`, `/shifts`), Company Tasks (`/tasks`), and Approvals Inbox (`/approvals`).
   * Inclusion of `ROLES.ADMIN` in `allowedRoles` for these routes in `navigation.tsx`.
4. **Impact:**  
   Super Admin cannot discover or access operational modules without typing direct URLs.
5. **Required Work:**  
   Update `apps/web/src/shell/navigation.tsx` to add Admin sidebar items under a unified "Operations" or "Administration" group.
6. **Modules Affected:** `apps/web/src/shell/navigation.tsx`.
7. **Blocking:** Blocks Admin access to live attendance policies, leave policies, and approval actions.
8. **Priority:** **High (P1)**.

---

### GAP-03: Lack of Direct Standalone User Provisioning API
1. **Requirement Expectation:**  
   Admin must be able to provision administrative or support user accounts directly without being forced to create a full employee record with department, designation, and manager foreign keys.
2. **Current Code Implementation:**  
   `apps/api/src/modules/users/users.routes.ts` only provides:
   * `GET /api/v1/users`
   * `GET /api/v1/users/:id`
   * `PUT /api/v1/users/:id/roles`
   User creation logic is embedded exclusively inside `EmployeeCreationService` (`apps/api/src/modules/employees/creation/creation.service.ts`), which requires `employee_code`, `department_id`, `designation_id`, and `joining_date`.
3. **What is Missing:**  
   * `POST /api/v1/users` endpoint accepting `{ name, email, roles, temporaryPassword }`.
   * UI modal on `UsersPage.tsx` ("Add System User").
4. **Impact:**  
   Creating a contractor, external auditor, or system administrator requires dummy employee directory data.
5. **Required Work:**  
   Add `createUser` method to `UsersService` and expose `POST /api/v1/users` with `users.create` permission.
6. **Modules Affected:** `apps/api/src/modules/users/`, `apps/web/src/features/users/`.
7. **Blocking:** None.
8. **Priority:** **High (P1)**.

---

### GAP-04: Payslip Management & Sensitive HR Compensation Architecture
1. **Requirement Expectation:**  
   Per Product Baseline §1.2 & Decision D-16: direct tax/payroll processing is external, but the system must provide certified attendance/leave summaries and **read-only payslips** for employees, with sensitive compensation fields protected by explicit permissions.
2. **Current Code Implementation:**  
   * Reports provide certified CSV/PDF exports (`attendance-summary`, `leave-usage`).
   * No `payslips` table exists in PostgreSQL migrations.
   * No backend router for payslip upload (`POST /api/v1/payslips`) or employee viewing (`GET /api/v1/payslips`).
   * `StaffDashboard.tsx` contains static dummy cards for payslips.
   * `App.tsx` has no route for `/staff/payslips`.
3. **What is Missing:**  
   * PostgreSQL table `payslips` (`id`, `employee_id`, `period_month`, `period_year`, `file_id`, `gross_pay`, `net_pay`, `generated_at`).
   * API endpoints for Admin/HR bulk payslip upload and employee download.
   * Permission catalog entry `payslips.manage` and `payslips.read`.
4. **Impact:**  
   Staff cannot view compensation slips, and Admin has no digital payslip distribution mechanism.
5. **Required Work:**  
   Create DB migration for payslips, build file storage adapter integration, expose endpoints, and build UI.
6. **Modules Affected:** `apps/api/src/db/migrations`, `apps/api/src/modules/payslips/` (new), `apps/web/src/features/payslips/` (new).
7. **Blocking:** Dependent on external payroll CSV import or PDF upload specification.
8. **Priority:** **High (P1)**.

---

### GAP-05: Absence of Admin-Triggered Backup & Disaster Recovery Telemetry
1. **Requirement Expectation:**  
   The baseline documentation (`docs/architecture/settings.md` & `docs/operations/runbook.md`) references backup and restore procedures for PostgreSQL. Admin should be able to view backup health, latest backup timestamp, and trigger ad-hoc snapshot requests.
2. **Current Code Implementation:**  
   Backups are handled by bash scripts (`scripts/drill-backup-restore.sh`) and GitHub Actions workflows (`.github/workflows/deploy.yml`). There is zero in-app visibility for Admin in `CompanySettingsPage.tsx`.
3. **What is Missing:**  
   * Backend endpoint `GET /api/v1/admin/backups` reading backup storage metadata or health status.
   * UI status badge in `CompanySettingsPage.tsx`.
4. **Impact:**  
   Super Admin has no dashboard reassurance that automated backups are running.
5. **Required Work:**  
   Create health/backup telemetry reader endpoint and add a "System Maintenance & Backup" card to `CompanySettingsPage.tsx`.
6. **Modules Affected:** `apps/api/src/modules/settings/`, `apps/web/src/features/settings/`.
7. **Blocking:** None.
8. **Priority:** **Medium (P2)**.

---

## 4. Admin Module Page-Level Assessment

| Page Name | Existing Route | Existing Frontend Component | Related Backend API | Current Functionality | Missing Functionality | UI/UX & Permission Gaps | Overall Status |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **System Admin Dashboard** | `/dashboard`<br>`/admin/*` | `apps/web/src/dashboards/AdminDashboard.tsx` | *None* | Displays static KPI cards, distribution list, security audit list, sample badge. | Real API connection, live telemetry, interactive quick action dialogs. | All cards show hardcoded numbers. Action buttons have no onClick handlers. | **UI Only** |
| **Users & Roles Admin** | `/admin/users` | `apps/web/src/features/users/pages/UsersPage.tsx` | `GET /api/v1/users`<br>`PUT /api/v1/users/:id/roles`<br>`GET /api/v1/roles`<br>`GET /api/v1/permissions` | Paginated user accounts table, text search, role filter, active toggle, Role Assignment Modal, permissions catalog matrix. | Direct "Create User" action, password reset trigger, direct user deactivation button. | Deactivation only possible via Employee page. Cannot invite external admin user. | **Implemented** (CRUD gaps) |
| **Employee Directory** | `/admin/employees`<br>`/employees` | `apps/web/src/features/employees/pages/EmployeeDirectoryPage.tsx` | `GET /api/v1/employees`<br>`GET /api/v1/departments`<br>`GET /api/v1/designations` | Company-wide directory search, status filters, department filters, grid/table view, detail modal. | Bulk employee actions, export directory to CSV directly from view. | None. Fully responsive with mobile card transformation. | **Implemented** |
| **Create Employee** | `/admin/employees/new`<br>`/employees/new` | `apps/web/src/features/employees/pages/CreateEmployeePage.tsx` | `POST /api/v1/employees` | Multi-step form: Personal info, department, designation, manager selection, auto-generates user account. | Custom welcome email template preview. | None. Form validation (Zod) and error states verified. | **Implemented** |
| **Employee Detail & Edit** | `/admin/employees/:id`<br>`/employees/:id` | `apps/web/src/features/employees/pages/EmployeeDetailPage.tsx` | `GET /api/v1/employees/:id`<br>`PUT /api/v1/employees/:id` | Tabbed view: Profile overview, employment details, documents tab, manager hierarchy card, edit modal. | Compensation/Salary history tab (data model absent). | None. | **Implemented** |
| **Employee Deactivation** | `/admin/employees/:id/deactivate` | `apps/web/src/features/employees/pages/EmployeeDeactivationPage.tsx` | `POST /api/v1/employees/:id/deactivate` | Confirmation dialog, effective date selection, direct reports reassignment warning, instant Redis session purge. | Offboarding asset recovery checklist. | None. Admin-only route guard enforced. | **Implemented** |
| **Org Chart** | `/admin/org-chart`<br>`/employees/org-chart` | `apps/web/src/features/employees/pages/OrgChartPage.tsx` | `GET /api/v1/employees/org-roots`<br>`GET /api/v1/employees/:id/reports` | Interactive org hierarchy tree, expandable nodes, employee summary popovers. | Zoom controls, PDF/SVG export of org tree. | None. | **Implemented** |
| **Departments Management** | `/admin/departments`<br>`/departments` | `apps/web/src/features/departments/pages/DepartmentsPage.tsx` | `GET,POST,PUT,DELETE /api/v1/departments` | Table view, department create/edit modal, active status toggle, deactivation confirmation dialog. | Department budget and head allocation fields. | None. | **Implemented** |
| **Designations Management** | `/admin/designations`<br>`/designations` | `apps/web/src/features/designations/pages/DesignationsPage.tsx` | `GET,POST,PUT,DELETE /api/v1/designations` | Seniority level, department filter, title/code uniqueness, title create/edit dialog. | Pay-grade band configuration. | None. | **Implemented** |
| **Audit Logs Viewer** | `/admin/audit`<br>`/admin/audit-logs` | `apps/web/src/features/audit-logs/pages/AuditLogsPage.tsx` | `GET /api/v1/audit-logs` | Paged log table, search, module filter, action filter, outcome filter, date range pickers, JSON diff inspector modal. | Scheduled automated audit digest export. | None. Admin-only permission strictly verified. | **Implemented** |
| **Company Configuration** | `/admin/settings`<br>`/settings` | `apps/web/src/features/settings/pages/CompanySettingsPage.tsx` | `GET,PUT /api/v1/settings` | Company name, IANA timezone selector, work week start/end selector, integration toggles (email, SMS, calendar, payroll). | Automated backup status, logo upload, email SMTP test button. | Save button triggers live `PUT` with audit trail. | **Implemented** |
| **Company Reports** | `/admin/reports`<br>`/reports` | `apps/web/src/features/reports/pages/ReportsPage.tsx` | `GET /api/v1/reports`<br>`GET /api/v1/reports/:name`<br>`GET /api/v1/reports/:name/export` | 7 report selector, live data preview, filter toolbar, CSV download, PDF download via background worker. | Scheduled automated email delivery of reports. | None. Clean loading skeletons and empty states. | **Implemented** |
| **Shift & Attendance Policies** | `/hr/policies`<br>`/shifts` *(Unlinked for Admin)* | `apps/web/src/features/shifts/pages/ShiftsAndPoliciesPage.tsx` | `GET,POST,PUT,DELETE /api/v1/shifts`<br>`GET,PUT /api/v1/attendance/policies` | Shift configuration (start/end times, grace period, default shift flag), half/full-day thresholds. | Geofencing and IP restriction configuration. | **Unlinked in Admin Sidebar.** Admin cannot navigate here from menu. | **Backend Only (for Admin)** |
| **Leave Policies & Holidays** | `/leave/policies`<br>`/leave/holidays` *(Unlinked for Admin)* | `apps/web/src/features/leave/pages/LeaveManagementPage.tsx` | `/api/v1/leave-policies`<br>`/api/v1/holidays`<br>`/api/v1/leave-balances` | Leave type creation, yearly quotas, carry-forward rules, paid/unpaid flags, holiday calendar manager. | Accrual frequency rules (monthly vs yearly). | **Unlinked in Admin Sidebar.** Admin has no menu access. | **Backend Only (for Admin)** |
| **Approvals Command Center** | `/lead/approvals`<br>`/approvals` *(Unlinked for Admin)* | `apps/web/src/features/approvals/pages/ApprovalsInboxPage.tsx` | `GET /api/v1/approvals`<br>`POST /api/v1/approvals/:id/approve`<br>`POST /api/v1/approvals/:id/reject` | Company-wide approvals inbox across leave, attendance corrections, and expenses. Single and batch decision actions. | Bulk approve/reject with single comment. | **Unlinked in Admin Sidebar.** Admin omitted from navigation. | **Backend Only (for Admin)** |
| **Projects & Tasks Oversight** | `/projects`<br>`/tasks` | `ProjectsListPage.tsx`<br>`TasksPage.tsx` | `/api/v1/projects`<br>`/api/v1/tasks` | Project cards, task Kanban board, task status transitions, comments, attachments. | Direct `/tasks` navigation item in Admin sidebar. | `/tasks` missing from Admin sidebar; only accessible via project drill-down. | **Partially Implemented** |
| **Financial Expenses Oversight** | `/expenses` | `apps/web/src/features/expenses/pages/ExpensesPage.tsx` | `/api/v1/expense-categories`<br>`/api/v1/expense-claims` | Claim reviews, receipt download via signed private storage links, category CRUD. | Currency conversion rules, corporate card reconciliation. | None. Fully functional. | **Implemented** |
| **System Notifications & Announcements** | `/notifications` | `NotificationsInboxPage.tsx` | `GET,PATCH /api/v1/notifications`<br>`POST /api/v1/notifications/announcements` | System announcement composer modal, personal notifications list, unread counters. | Push notification integration. | None. Admin broadcast capability operational. | **Implemented** |
| **Payslips Administration** | *None* | *None* | *None* | *None* | Entire module missing. | Route `/staff/payslips` is unhandled. | **Not Implemented** |

---

## 5. Functional and Technical Validation

### 5.1 Frontend Architecture Assessment
* **Route Guards & Protection:** `RouteGuard.tsx` properly wraps all authenticated pages. However, because `isPathAuthorizedForRole` relies on `NAVIGATION_REGISTRY`, routes not assigned to `ROLES.ADMIN` (such as `/hr/policies` and `/lead/approvals`) deny or conceal access to Super Admin.
* **Component Quality:** Form inputs, buttons, tables, and dialogs follow standardized patterns. Loading skeletons, empty states, and error cards are implemented across user management, settings, audit logs, and reports.
* **Navigation Isolation:** Sidebar is strictly filtered via `getSidebarGroupsForRole(role)`. As noted, this currently filters out key operational links for Admin.

### 5.2 Backend Architecture Assessment
* **Modular Layering:** Modules in `apps/api/src/modules/` are strictly organized into router, service, repository, and schema files.
* **Authorization Pattern:** Handlers enforce permissions using `requirePermission(perm)` middleware, mapping callers to `actorId`, `roles`, and `recordScope`.
* **Idempotency:** Sensitive mutations (`POST /employees`, `POST /attendance/corrections`, `POST /expenses`, `PUT /settings`) accept `Idempotency-Key` headers stored in Redis.
* **Input Validation:** Every endpoint validates params, query, and body using Zod schemas with strict coercion and unknown key rejection.

### 5.3 Database Architecture Assessment
* **PostgreSQL Schema:** 41 migration scripts implement referential integrity, foreign key indexes, partial unique indexes (e.g. `idx_attendance_one_open_per_emp`), and enum constraints.
* **Immutability:** `audit_logs` table has a trigger (`trg_audit_logs_immutable`) raising exceptions on any update or deletion attempt.
* **Missing Tables:** No tables exist for `payslips`, `compensation_history`, or `employee_bank_accounts`.

### 5.4 Security Assessment
* **Authentication & Sessions:** Password hashing uses Argon2id with OWASP-recommended parameters (`memoryCost: 65536, timeCost: 3, parallelism: 4`). Sessions are stored in Redis with 14-day absolute TTL and revoked immediately upon deactivation.
* **CSRF & Rate Limiting:** Double-submit cookie pattern with cryptographic tokens (`x-csrf-token`). Global rate limiting via Redis token bucket.
* **Data Leakage & Redaction:** Passwords, tokens, bank accounts, and secrets are redacted in loggers and masked in the audit log viewer API.

---

## 6. Admin Permission Gap Analysis

| Capability | Requirement | Code Implementation | Status / Gap |
|:---|:---|:---|:---|
| **User Creation** | Super Admin provisions users directly. | Only via `POST /employees`. | **Gap:** No standalone `POST /users` endpoint. |
| **User Deactivation** | Super Admin terminates employee access. | `POST /employees/:id/deactivate`. | **Fully Enforced:** Ends Redis sessions atomically. |
| **Role Assignment** | Assign any of the 4 roles. Prevent orphan system. | `PUT /users/:id/roles`. | **Fully Enforced:** Last admin safeguard locked in DB transaction. |
| **Custom Roles** | Create custom roles with custom permissions. | Roles fixed at 4 by Decision D-21. | **Gap:** Dynamic roles not supported in MVP. |
| **Department Admin** | Create, update, deactivate departments/titles. | Full CRUD in `/departments` & `/designations`. | **Fully Enforced.** |
| **Company Reporting** | Full company-wide data access on reports. | `GET /reports/*` with scope `all`. | **Fully Enforced.** |
| **Sensitive HR Access** | View/manage bank details, ID proofs, compensation. | Only document uploads supported (`/documents`). | **Gap:** Data model for bank/compensation missing. |
| **System Settings** | Manage company parameters. | `GET,PUT /settings`. | **Fully Enforced:** Admin-only access verified. |
| **Audit Log Access** | View complete system audit trail. | `GET /audit-logs`. | **Fully Enforced:** Strictly restricted to `ROLES.ADMIN`. |
| **Delegated Approvals** | Super Admin override on pending approvals. | Backend: `approvals.decide` allows Admin. Frontend: unlinked. | **Gap:** Frontend does not expose Approvals UI to Admin. |

---

## 7. Priority-Based Gap Classification

### P0 – Critical / System-Blocking Issues
* **GAP-01 (Admin Dashboard Telemetry):** `AdminDashboard.tsx` is completely disconnected from the backend and displays hardcoded sample data. A dedicated backend analytics/KPI endpoint is required.

### P1 – Essential Admin Functionality
* **GAP-02 (Admin Navigation Gaps):** Admin sidebar lacks links to Attendance, Leave Policies, Shift Policies, Company Tasks, and Approvals.
* **GAP-03 (Direct User Account Creation):** Inability to create administrative/system users without generating a full employee record.
* **GAP-04 (Payslips Module Missing):** Payslip upload, storage, and viewing are not implemented in backend or database.

### P2 – Important Operational Improvements
* **GAP-05 (Backup Telemetry UI):** No Admin interface to check automated database backup health or trigger manual snapshot requests.
* **GAP-06 (Direct Tasks Link in Sidebar):** Admin has `/projects` in sidebar but lacks direct `/tasks` overview link.

### P3 – UI/UX Enhancements & Optimizations
* **GAP-07 (Dashboard Quick Action Modals):** Connect the "+ Create task", "Add User", and "Export Audit Log" buttons on the Admin Dashboard to their respective modals.
* **GAP-08 (Org Chart Controls):** Add zoom controls and SVG/PDF export to the organization chart viewer.

---
*Report compiled and verified against repository commit `356621d`.*

