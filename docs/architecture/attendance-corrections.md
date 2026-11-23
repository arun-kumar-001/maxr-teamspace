# Attendance corrections (#36, D-13, D-28)

An employee asks to change the check-in and check-out of one of their own attendance records. The request is decided through the [approvals engine](approvals.md); approval overwrites the record in the same transaction as the decision.

## API

| Route                                      | Permission                            | Notes                                                                                                                                                                                                                                                 |
| ------------------------------------------ | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /attendance/corrections`             | `attendance.request_correction` (own) | `Idempotency-Key` required. Body: `attendanceRecordId`, `requestedCheckIn`, `requestedCheckOut` (ISO instants with an offset), `reason` (1 to 500 characters). The employee is the signed-in caller, never the body. 201 with the pending correction. |
| `GET /attendance/corrections`              | `attendance.read_own`                 | The caller's own corrections, newest first; `status`, `page`, `pageSize`.                                                                                                                                                                             |
| `GET /attendance/corrections/{id}`         | `attendance.read_own`                 | The caller's own, or one inside the approvers' scope (`attendance.approve_correction`: Team Lead direct reports, HR and Admin everyone). 404 otherwise, identical to a missing id.                                                                    |
| `POST /attendance/corrections/{id}/cancel` | `attendance.request_correction`       | Requester only, while pending. 409 once decided.                                                                                                                                                                                                      |

Approvers do not decide here. They find the request in `GET /approvals?subjectType=attendance_correction&awaitingMyDecision=true` and use `POST /approvals/{id}/approve` or `/reject`. Route: the requester's manager, else HR (D-12).

## Rules (D-28)

- The record must be the caller's own (anyone else's is a 404) and no more than 30 days old by the company date.
- The requested check-in falls on the record's work date (company timezone); check-out is after check-in, at most 24 hours later, and neither is in the future.
- The corrected interval may not overlap another session of the employee. An open session counts as running on. Checked again when the approval is applied; if an overlap appeared meanwhile the approval fails with 409 and stays pending, so the approver can reject it.
- One pending correction per record, enforced by a partial unique index (two simultaneous requests: one 201, one 409).
- Approval overwrites check-in, check-out, duration and `late`/`present` (from the shift and its grace, as at check-in) and writes `attendance.correction_apply` with the before and after values in the same transaction. Repeating an approval changes nothing and writes nothing.
- Rejection and cancellation leave the record as it was.

## Locking

Decisions lock the approval, then the correction, then the record. Cancel takes the approval first (through `approvals.cancel`) and then the correction, so a cancel and a decision at the same moment cannot wait on each other. Exactly one wins; the correction and its approval always end in the same status.

## Data

`attendance_corrections` (migration `20261030000018`): the record, the employee, the original and requested times, `reason`, `status`, with CHECKs on the times and the status. RBAC key `attendance.request_correction` in migration `20261030000019`.
