# Leave requests: applying and deciding (#39, #40, D-12, D-30)

Applying for leave, and the approve/reject path of the approvals engine for `leave_request`. Cancelling an approved request (balance restored) and the team leave calendar come next (#40).

## API

| Route | Permission | Notes |
| --- | --- | --- |
| `POST /leave-requests` | `leave.apply` (own) | `Idempotency-Key` required. Body: `leaveTypeId`, `startDate`, `endDate` (`YYYY-MM-DD`), `halfDay` (default false), `reason` (optional, up to 500 characters). The employee is the signed-in caller. 201 with the request, `pending`. |
| `GET /leave-requests/me` | `leave.read_own` | Your requests, latest first. Filters `status`, `leaveTypeId`, `from`, `to` (requests touching the range), `page`, `pageSize`. |
| `GET /leave-requests` | `leave.list` | Team Lead: direct reports; HR and Admin: everyone. Same filters plus `employeeId`. |
| `GET /leave-requests/{id}` | `leave.read_own` | Yours, or one inside the approvers' scope (`leave.list`). 404 otherwise, identical to a missing id. |

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

## Data

`leave_requests` (migration `20261030000022`): CHECKs on the dates, the single year, the half-day shape, the day amount (half-day steps) and the status; an exclusion constraint for overlapping live requests. RBAC key `leave.list` in `20261030000023`.
