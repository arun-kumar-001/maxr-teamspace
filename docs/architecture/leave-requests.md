# Leave requests: applying and deciding (#39, #40, D-12, D-30)

Applying for leave, deciding it through the approvals engine, cancelling it (balance restored) and the leave calendar.

## API

| Route | Permission | Notes |
| --- | --- | --- |
| `POST /leave-requests` | `leave.apply` (own) | `Idempotency-Key` required. Body: `leaveTypeId`, `startDate`, `endDate` (`YYYY-MM-DD`), `halfDay` (default false), `reason` (optional, up to 500 characters). The employee is the signed-in caller. 201 with the request, `pending`. |
| `GET /leave-requests/me` | `leave.read_own` | Your requests, latest first. Filters `status`, `leaveTypeId`, `from`, `to` (requests touching the range), `page`, `pageSize`. |
| `GET /leave-requests` | `leave.list` | Team Lead: direct reports; HR and Admin: everyone. Same filters plus `employeeId`. |
| `GET /leave-requests/{id}` | `leave.read_own` | Yours, or one inside the approvers' scope (`leave.list`). 404 otherwise, identical to a missing id. |
| `GET /leave-requests/calendar?from=&to=` | `leave.list` | Who is away: pending and approved leave touching the range (at most 62 days), for direct reports (Team Lead) or everyone (HR, Admin). No reasons. At most 2000 entries. |
| `POST /leave-requests/{id}/cancel` | `leave.cancel` (own); `leave.cancel_any` (HR, Admin) | See below. |

Approvers decide in `GET /approvals?subjectType=leave_request&awaitingMyDecision=true` with `POST /approvals/{id}/approve` or `/reject` (a rejection needs a comment). Route (D-12): the requester's manager; HR when there is none; a Team Lead's, HR Manager's or Admin's own leave goes to HR / Admin. Nobody decides their own request.

## Rules (D-30)

- **Day count:** working days of the company week (settings), minus holidays. A half day is a single date and counts 0.5. A range with no working day is refused (422).
- **One year:** a request stays inside one calendar year (it draws on one balance row). Apply separately for a range that spans New Year.
- **Start date:** not before today on the company clock, except that the policy's `maxBackdateDays` allows it (Sick: 7 days).
- **Half day:** only for types whose policy allows it.
- **Balance** (types that have one): the balance left minus the days of your applied and pending requests must cover the days asked for (422 otherwise). The balance row is locked while the request is checked, so two applications at once cannot both fit. Nothing is deducted until approval.
- **Overlap:** an applied, pending or approved request blocks every date it covers (409). Rejected and cancelled requests do not. A database exclusion constraint enforces this, so two simultaneous requests cannot both succeed.
- **State:** the request is `applied` for an instant and `pending` once its approval is open, in the same transaction. The reason is kept out of the audit trail and of e-mails (it can be private).

## Deciding (the handler)

`LeaveRequestsService` is the approvals handler for `leave_request`, called inside the decision transaction after the approval and its audit entry:

- **Approve:** locks the request, adds the days to the balance's `used` in one statement that also checks it still covers them, marks the request approved and audits `leave.approve` with the balance before and after. If the balance no longer covers it (other leave was approved first) the whole decision is undone with a 409 and the approval stays pending; the approver rejects it instead. A type without a balance is only marked approved.
- **Reject:** marks the request rejected. Nothing is deducted.
- A failure anywhere leaves the approval pending, the request pending and the balance untouched. Repeating an approval that stands changes nothing.

## Cancelling (D-12)

- The owner cancels while the request is applied or pending: the approval is withdrawn and nothing changes in the balance.
- The owner cancels approved leave only **before its start date** (403 from the start day on: ask HR).
- HR Manager and Admin (`leave.cancel_any`) cancel approved or pending leave of anyone in scope at any time. Their own leave follows the owner's limit.
- Cancelling approved leave gives its days back to the balance in the same transaction and audits `status` and `balanceUsed` before and after. A type without a balance changes no balance.
- Rejected and cancelled requests are final (409). Someone else's request is a 404.
- Locks are taken in the order a decision uses (approval, request, balance), so a cancel and a decision at the same moment cannot deadlock; exactly one wins and the balance always matches the status.

## Data

`leave_requests` (migration `20261030000022`; RBAC key `leave.cancel_any` in `20261030000024`): CHECKs on the dates, the single year, the half-day shape, the day amount (half-day steps) and the status; an exclusion constraint for overlapping live requests. RBAC key `leave.list` in `20261030000023`.
