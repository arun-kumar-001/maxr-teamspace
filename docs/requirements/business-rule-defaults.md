# Business rule defaults (D-12 to D-20, D-23)

**Status:** defaults chosen by the TL assistant on 2026-10-30 so feature work is not blocked. The TL can change any of them by editing this file and telling the developers; a change after code exists needs a follow-up issue. Numbers (leave days, hours) are starting values for company settings and policies, not hard-coded constants. Spec references: `product-baseline.md` §10, report T§4.1.

Where a default needs a new table, state or security mechanism, it says so, and the owning issue must flag it to the TL before building (shared tables and auth are TL-approved).

---

## D-12 Leave workflow (#38, #39, #40)

**States:** `applied → pending → approved | rejected → cancelled`.

- `applied`: submitted and recorded, no approver resolved yet. `pending`: routed to an approver's inbox. Routing runs in the same transaction as the submit, so a request is normally `applied` only for an instant; it stays `applied` (visible to HR) only if no approver can be found.
- **Approver routing:** the requester's manager (Team Lead) if there is one; otherwise HR Manager. A Team Lead's own leave goes to HR Manager. An HR Manager's and an Admin's leave goes to Admin / HR Manager respectively (never themselves). No self-approval, ever.

| From                | To        | Who                                                  | Notes                                                                    |
| ------------------- | --------- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| (new)               | applied   | requester                                            | dates, type, reason (optional)                                           |
| applied             | pending   | system                                               | on routing                                                               |
| applied, pending    | cancelled | requester                                            | no balance change                                                        |
| pending             | approved  | approver                                             | **one transaction:** state + balance deduction (row lock on the balance) |
| pending             | rejected  | approver                                             | comment required                                                         |
| approved            | cancelled | requester before the start date; HR Manager any time | balance restored in the same transaction                                 |
| rejected, cancelled | none      |                                                      | terminal                                                                 |

**Leave types (HR-editable policy):** Annual 18 days/year, Casual 6, Sick 12, Unpaid (no balance). Half-day allowed (0.5 steps). Maternity, paternity and others are added by HR as policy, not code.
**Balance:** one row per employee, year and type. The yearly allotment is credited on 1 January (pro-rata by months for joiners). Annual carry-forward at most 5 days; the rest lapses. A balance can never go negative: insufficient balance is rejected (the employee applies for Unpaid instead).
**Day count:** working days only: excludes the company weekend (D-13) and holidays from the holiday calendar. End date must be on or after start; overlapping requests of the same employee are rejected; back-dated requests up to 7 days are allowed for Sick only.

## D-13 Attendance, shifts and timezone (#33, #34, #35, #36)

- **Timezone:** the company timezone setting (`company_settings.timezone`, production default `Asia/Kolkata`). All timestamps are stored in UTC and shown in the company timezone. **Work week:** Monday to Friday (setting).
- **Shifts:** table `shifts` (code, name, start, end, grace minutes, crosses midnight flag) and date-effective `employee_shifts`. An employee has at most one active shift on a date (no overlap). Default shift "General" 09:00-18:00, grace 15 minutes. A shift that crosses midnight belongs to the date it starts.
- **Status per day (computed):** `present`, `late` (check-in after start + grace), `half_day` (worked 4 to under 8 hours), `absent` (no session on a working day, no approved leave). Full day = 8 hours worked. Overtime is not computed in the MVP (hours are reported only).
- **Sessions:** server time only; one open session per employee (partial unique index); duplicate check-in is 409; check-out needs an open session. Location: no GPS in the MVP; check-in carries an optional `workMode` of `office` or `remote`.
- **Corrections:** `attendance_corrections` (record, requested check-in/out, reason up to 500 characters, status). Allowed for records up to 30 days old, one open correction per record. Decided through the approvals engine (D-12 routing: Team Lead of the requester, else HR). Approval overwrites the times atomically and the audit entry holds before and after values.

## D-14 Projects and tasks (#42, #43)

- Add `projects` (name, code, owner employee, status `active|archived`, optional dates) and `project_members`; `tasks.project_id` is optional (tasks can exist without a project).
- **Who:** Team Lead (for their team) and Admin create and manage projects; a project's members must be the lead's direct reports or the lead. Members read their projects.
- **Task states:** `todo → in_progress → in_review → completed`, plus `blocked`. Allowed moves: todo→in_progress; in_progress→in_review | blocked | todo; in_review→completed | in_progress; blocked→in_progress; completed→in_progress (reopen, Team Lead only). **Only the Team Lead who assigned the task (or Admin) moves it to `completed`**; the assignee can move it to `in_review`. Illegal moves return 422.
- Priority `low|medium|high|urgent`; optional due date; assignment only to the assigner's team (outside the team is denied).

## D-15 Notifications (#41)

- In-app inbox (`notifications` table, own only) plus email through the outbox. **SMS is out of the MVP.**
- Templates live in code, versioned, with variables. **Email carries no sensitive data** (no leave reason, no amounts): it names the event and links to the app.
- Sent after commit, retried with backoff (3 attempts); failures stay visible in the outbox.
- **Reminders:** a scheduled job in the API process (database advisory lock so only one instance runs), every 15 minutes: task due in 24 hours; approvals pending over 24 hours; meeting starting in 15 minutes.
- Read notifications are kept 90 days. Admin announcements are in-app only.

## D-16 Payslips (no issue yet)

Out of the MVP and not scheduled. When built: read-only. HR uploads one PDF per employee and month through the storage adapter (or imports from the external payroll export); the system computes nothing. Only the employee and HR see a payslip (`payslips.read_own`, `payslips.manage`). Compensation data is never stored in the application database beyond file metadata.

## D-17 Expenses (#29)

- **States:** `submitted → approved | rejected`, then `approved → reimbursed` (HR marks it); `submitted → cancelled` by the claimant.
- **Approvers:** two steps through the approvals engine: Team Lead (team) then HR Manager (final). A Team Lead's own claim goes to HR only; nobody approves their own claim.
- **Categories (HR-managed list):** Travel, Meals, Accommodation, Office supplies, Client entertainment, Other.
- **Money:** one company currency, INR (company setting); amounts stored as integer minor units (paise) with the currency code. Maximum 100,000.00 per claim.
- **Rules:** claim date not in the future and not older than 60 days; receipt required above 200.00; receipts PDF, JPG or PNG up to 5 MB; receipt visible only to the claimant and approvers.

## D-18 Meetings (#45; #46 calendar sync stays optional)

- Team Lead, HR Manager and Admin can schedule; Staff are invited but do not schedule. Up to 100 invitees (active employees). Only the organizer and invitees see a meeting.
- Times stored in UTC, shown in the company timezone. An overlap with the organizer's or an invitee's other meeting is a **warning**, not a block. RSVP: accepted, declined, tentative.
- Agenda and minutes are plain text (minutes up to 20,000 characters), editable by the organizer. Reminder 15 minutes before (in-app and email, D-15).
- Google/Outlook sync: not in the MVP; needs your approval before #46 starts.

## D-19 Offboarding (#26)

Mirrors onboarding with owners and items:

1. **HR:** resignation or termination recorded with last working day; exit interview done.
2. **Manager:** knowledge handover and open tasks reassigned.
3. **IT/Admin (Admin role):** assets returned (laptop, ID card); accounts and tool access revoked.
4. **HR:** final settlement information handed to payroll (outside this system).
5. **Employee:** acknowledgement of the exit checklist.
   Deactivation (`POST /employees/{id}/deactivate`, which ends all sessions) happens on the last working day, or immediately when Admin chooses "deactivate now". History and audit are retained; nothing is deleted.

## D-20 Onboarding checklist (#24)

Four steps in order, each with an owner and items; **the account activates only after every item is verified**:

1. **HR (HR Manager):** ID proof, address proof and signed offer letter collected; employee code, department, designation, manager and joining date confirmed.
2. **System (automatic):** account created in `pending` (cannot log in), role assigned, default leave balances created, default shift assigned, welcome email queued (after commit).
3. **IT/Admin (Admin role until a separate IT role exists):** work email and tool access granted, equipment issued.
4. **Employee:** claims the account through a single-use, expiring (72 hours), hashed set-password link, confirms their profile and acknowledges the policies; HR/Admin then verifies the last items and **activates** the account (employee status `active`, user active).

- Login before activation fails with the generic message. A reopened step moves the employee back to `pending`.
- The set-password link is a new auth surface: #24 must flag its design to the TL for security review before building it.

## D-23 HR delegated deactivation (#26)

Deactivation stays **Admin only** in the MVP (`employees.deactivate`). Delegating it to HR is a catalog change plus migration decided by the TL, not a setting.
