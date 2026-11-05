# MAXR CRM – Super Admin / Founder Module: Gap Summary for Project Lead

**To:** Project Lead  
**From:** Technical Lead & Code Auditor  
**Date:** November 4, 2026  
**Subject:** Implementation Status, Gaps & Remediation Plan for the Super Admin / Founder Module  
**Scope:** Super Admin / Founder Module Only (MAXR Teamspace Repository)  

---

## 1. Executive Status Overview

An in-depth technical audit was conducted on the **Super Admin / Founder module** within the `maxr-teamspace` codebase, comparing actual source code against the approved *MAXR ONE Staff Management HLD/LLD Specification v1.0* and Product Baseline.

### Summary Verdict
* **Backend Governance & Security is 85% Complete & Production-Grade:**  
  Authentication (Argon2id), RBAC enforcement, session invalidation via Redis, immutable audit logging with double redaction, company settings singleton, 7 operational reports (CSV + sandboxed worker-thread PDF export), and department/designation lifecycle management are fully implemented and verified with comprehensive integration tests.
* **Frontend Admin Experience is ~60% Functional Due to Key Disconnects:**  
  While individual admin management pages (Users, Audit, Settings, Reports, Employees, Departments) are functional, the **primary Admin Dashboard is running on static mock data**, and the **Admin Sidebar Navigation excludes essential operational links** (Attendance, Leave Policies, Shift Policies, Tasks, and Approvals).
* **Missing Enterprise Capability:**  
  The read-only payslips module and direct system user creation without employee profiles have not been developed.

---

## 2. Capability Breakdown

### A. Already Available (Verified & Production Ready)
1. **Immutable Audit Logging (`/admin/audit`):**  
   Append-only audit trail backed by a PostgreSQL trigger blocking `UPDATE`/`DELETE`/`TRUNCATE`. Filterable by actor, action, module, outcome, and date range. Double-redaction prevents credential leaks.
2. **Company Configuration (`/admin/settings`):**  
   Singleton setting record (`company_settings`) with IANA timezone validation, custom workweek schedule, and integration toggles with in-process 60s cache invalidation.
3. **Role & Permission Management (`/admin/users`):**  
   Role assignment modal supporting the 4 fixed roles. Last active administrator safeguard is enforced via transactional database row locks.
4. **Departments & Designations Management (`/admin/departments`, `/admin/designations`):**  
   Full CRUD with case-insensitive unique code validation, active toggles, and referential constraint protection against deleting assigned entities.
5. **Employee Lifecycle Administration (`/admin/employees`):**  
   Company-wide directory search, multi-step employee onboarding creation, full profile inspection, and atomic employee deactivation with instant Redis session termination.
6. **Reporting Hierarchy & Org Chart (`/admin/org-chart`):**  
   Interactive tree visualization with cycle-detection logic preventing cyclical manager loops.
7. **Comprehensive Operational Reports (`/admin/reports`):**  
   7 reports (Headcount, Joiners/Leavers, Directory, Attendance Summary, Leave Usage, Tasks, Projects) with real-time JSON previews, CSV export (formula injection safe), and rate-limited worker-thread PDF export.
8. **Financial Expense Oversight (`/expenses`):**  
   Company-wide review of expense claims, signed URL downloads of receipts, and category administration.
9. **System-Wide Announcements (`/notifications`):**  
   Admin announcement modal with broadcast delivery to all active employee accounts.

---

### B. Partially Completed (Implementation Exists but Important Work Remains)
1. **User Account Administration (`/admin/users`):**  
   Admin can list, filter, and assign roles to users, but **cannot directly create a standalone user** without creating a full employee directory record.
2. **Project & Task Oversight (`/projects`, `/tasks`):**  
   Both project and task backends support Admin company-wide scope (`all`). While `/projects` is visible in the Admin sidebar, the unified `/tasks` board is omitted from the sidebar.
3. **Attendance & Leave Governance:**  
   Backend APIs for shifts, attendance policies, leave types, and holiday calendars are fully implemented and tested for Admin. However, the Admin sidebar lacks direct navigation to these management interfaces.

---

### C. Not Yet Available (Missing Features)
1. **Live Admin Dashboard Telemetry:**  
   No backend API (`GET /api/v1/admin/dashboard`) exists to calculate real-time KPI counts. The current dashboard uses hardcoded dummy metrics.
2. **Read-Only Payslips Module (`/staff/payslips`):**  
   Database table, storage upload API, and viewing endpoints are completely missing.
3. **In-App Database Backup Trigger / Status:**  
   Database backups operate via external CI scripts. No in-app status badge or manual snapshot trigger exists in the Admin settings UI.
4. **Custom Role / Dynamic Permission Editor:**  
   Roles are hardcoded to 4 per Decision D-21. Enterprise custom roles cannot be created via the UI.

---

### D. Issues Requiring Immediate Attention

| Issue Description | Severity | Risk / Impact | File References |
|:---|:---:|:---|:---|
| **Admin Dashboard displays fake static data** | **P0** | Executive team will see static sample data rather than live company metrics. | `apps/web/src/dashboards/AdminDashboard.tsx` |
| **Admin cannot access Attendance or Leave policies from Sidebar** | **P1** | Super Admin is locked out of configuring shifts, attendance policies, and holiday schedules via UI navigation. | `apps/web/src/shell/navigation.tsx` |
| **Admin cannot view or decide Approvals from Sidebar** | **P1** | Backend authorizes Admin for all approvals, but frontend menu only renders the Approvals Inbox for `TEAM_LEAD`. | `apps/web/src/shell/navigation.tsx` |
| **Cannot create standalone system users** | **P1** | Inability to onboard administrative accounts without populating fake HR employee records. | `apps/api/src/modules/users/users.routes.ts` |

---

## 3. Pending Development Tasks (Work Breakdown)

### Task T-ADM-01: Admin Dashboard Live Telemetry & Quick Action Wiring
* **Module:** Analytics / Admin Dashboard
* **Priority:** **P0 – Critical**
* **Dependencies:** `apps/api/src/modules/employees`, `attendance`, `approvals`, `tasks`
* **Description:**  
  Create backend endpoint `GET /api/v1/admin/dashboard` that returns real-time aggregated metrics:
  * Total employees and active accounts.
  * Today's attendance counts (present, late, absent, not checked in).
  * Total pending approvals (leave, attendance corrections, expenses).
  * Open tasks and overdue task counts.
  * Active Redis session count.
  * System health check status (PostgreSQL connection, Redis ping, ClamAV status).
* **Required Changes:**  
  1. Add `apps/api/src/modules/admin/dashboard.routes.ts` and `dashboard.service.ts`.
  2. Implement `useAdminDashboard()` hook in `apps/web/src/dashboards/`.
  3. Replace sample data in `AdminDashboard.tsx` with live data.
  4. Wire quick action buttons (`+ Create task`, `Add User`, `Export Audit Log`) to open their respective modals.
* **Acceptance Criteria:**  
  * `AdminDashboard.tsx` displays live numbers matching the database.
  * "Sample data" badge is removed.
  * Fast query response (< 200ms) using indexed SQL `COUNT` queries.

---

### Task T-ADM-02: Complete Super Admin Global Sidebar Navigation
* **Module:** Shell / Navigation
* **Priority:** **P1 – High**
* **Dependencies:** None
* **Description:**  
  Update `apps/web/src/shell/navigation.tsx` so that Super Admin has explicit sidebar links to all operational modules they are authorized to govern.
* **Required Changes:**  
  1. Add `ROLES.ADMIN` to `allowedRoles` for:
     * Shift & Attendance Policies (`/hr/policies` or create `/admin/policies`).
     * Leave Policies & Holiday Calendar (`/leave/policies`, `/leave/holidays`).
     * Approvals Inbox (`/approvals`).
     * Company Tasks Board (`/tasks`).
     * Attendance Management (`/attendance`).
  2. Organize Admin sidebar into logical groups:
     * **Overview:** Dashboard.
     * **Workforce:** Employee Directory, Org Chart, Departments, Designations.
     * **Operations:** Attendance & Shifts, Leave & Holidays, Approvals, Projects & Tasks.
     * **Administration:** Users & Roles, Company Config, Audit Logs, Reports.
* **Acceptance Criteria:**  
  * Super Admin can navigate to every authorized module from the sidebar without manually typing URLs.
  * Route guards grant access without 403 or redirect loops.

---

### Task T-ADM-03: Direct Standalone User Provisioning API & UI
* **Module:** Users & Roles
* **Priority:** **P1 – High**
* **Dependencies:** `apps/api/src/modules/users/`, `apps/api/src/modules/auth/`
* **Description:**  
  Enable Super Admin to provision system and administrative accounts directly without requiring an employee directory record.
* **Required Changes:**  
  1. Add `POST /api/v1/users` to `users.routes.ts` with `users.create` permission check.
  2. Implement password generation / temporary credential email invitation.
  3. Add "Add User" button and modal on `UsersPage.tsx`.
* **Acceptance Criteria:**  
  * Admin can create a new user account with specified roles (`admin`, `hr_manager`, etc.) directly from `/admin/users`.
  * Audit log records `users.create` event with actor and assigned roles.

---

### Task T-ADM-04: Digital Payslip Module (Schema, Storage & API)
* **Module:** Payroll / Payslips
* **Priority:** **P1 – High**
* **Dependencies:** Database Migration, Cantobo Private Storage Adapter
* **Description:**  
  Implement the read-only payslip management architecture per Product Baseline Decision D-16.
* **Required Changes:**  
  1. Add migration `create_table_payslips` (`id`, `employee_id`, `period_year`, `period_month`, `file_id`, `net_pay`, `gross_pay`, `uploaded_at`).
  2. Implement `apps/api/src/modules/payslips/` with:
     * `POST /api/v1/payslips/bulk` (Admin/HR upload with PDF storage).
     * `GET /api/v1/payslips` (Scoped by role: Staff sees own; Admin/HR sees all).
     * `GET /api/v1/payslips/:id/download` (Signed private storage URL).
  3. Create frontend `/staff/payslips` viewer and `/admin/payslips` upload manager.
* **Acceptance Criteria:**  
  * Admin can upload bulk monthly payslips.
  * Staff can view and download their monthly statement via secure signed links.

---

### Task T-ADM-05: In-App System Health & Backup Telemetry Card
* **Module:** System Settings
* **Priority:** **P2 – Medium**
* **Dependencies:** `apps/api/src/modules/settings/`
* **Description:**  
  Provide Super Admin with visibility into database backup execution, storage utilization, and system dependencies.
* **Required Changes:**  
  1. Expose `GET /api/v1/settings/system-health` returning PostgreSQL version, Redis connection state, last backup timestamp, and storage quota.
  2. Add "System Health & Maintenance" section in `CompanySettingsPage.tsx`.
* **Acceptance Criteria:**  
  * Super Admin can verify at a glance that backups are current and services are healthy.

---

## 4. Recommended Implementation Sequence

```
Week 1 (Quick Wins & Critical Visibility):
├── Step 1: Task T-ADM-02 (Update Admin Sidebar Navigation Registry)
│           └── Unlocks Attendance, Leave, Shifts, Approvals, and Tasks for Admin.
└── Step 2: Task T-ADM-01 (Admin Dashboard Live Telemetry API & UI)
            └── Replaces static mock data with live operational KPIs.

Week 2 (Account Governance & Self-Service):
├── Step 3: Task T-ADM-03 (Direct User Account Creation API & UI)
│           └── Enables administrative provisioning independent of HR employee creation.
└── Step 4: Dashboard Quick Action Wiring
            └── Connects Dashboard action buttons to live workflows.

Week 3 (Compliance & Financial Operations):
├── Step 5: Task T-ADM-04 (Payslip Database Schema, Storage & REST API)
└── Step 6: Task T-ADM-05 (System Health & Backup Status Card in Settings)
```

---
*Report ready for review and scheduling.*

