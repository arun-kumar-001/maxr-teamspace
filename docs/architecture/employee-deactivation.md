# Employee deactivation

Issue #26 (backend; the confirmation screen is Dev 1's). `POST /api/v1/employees/{id}/deactivate`, permission `employees.deactivate`: **Admin only** (D-23; delegating it to HR is a catalog change decided by the TL). Rules: D-19 (offboarding), G-04 (every user belongs to one employee).

## What it does

"Deactivate now": the employee and their sign-in account are switched off and **every session ends**. The body is empty (a strict `{}`), so nothing else can be changed through it. Nothing is deleted: the employee, the account, the roles, the history and the audit trail stay.

One database transaction, after taking the Admin-role lock (the same first lock role assignment in #27 takes, so the two cannot deadlock):

1. the employee row and the account row are locked;
2. an already-deactivated employee returns now (see below);
3. **the last active Admin cannot be deactivated** (422). An account that is inactive, or whose employee is not active, does not count as another Admin;
4. `employees.status` becomes `deactivated` (the trigger from #31 records `deactivated_at` and the one from #21 bumps `version`) and `users.is_active` becomes false;
5. the audit entry `employee.deactivate` is written in the same transaction, with the status change and the number of direct reports.

After the commit: the event `employee.deactivated` (employee id, user id, ids of the direct reports) and then every session of the account is ended through the auth module's `SessionService.revokeAllForUser`. A second audit entry `session.revoke_all` records how many sessions ended.

## Why a session cannot outlive it

The `authenticate` middleware reads the account and the employee status from the database on **every request**, so a deactivated account is refused on its very next request even before its sessions are removed from Redis. Ending the sessions is clean-up and a second line of defence. If it fails (Redis down), the deactivation still stands and is returned as a 200 with `sessionsRevoked: 0`; the error is logged and **repeating the call retries it**. Tests prove both halves separately: with the account still looking active, ending the sessions alone locks the employee out; and the deactivated account cannot sign in again with a password that worked a moment before.

## Responses

| Status | When                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 200    | Deactivated, or already deactivated (`alreadyDeactivated: true`, nothing changed, nothing audited, sessions ended again) |
| 403    | The caller is not an Admin                                                                            |
| 404    | No such employee                                                                                      |
| 422    | You cannot deactivate yourself (ask another Admin), or the target is the last active Admin           |

The body of a 200 is `{ id, status, deactivatedAt, version, alreadyDeactivated, sessionsRevoked, directReports: [{ id, employeeCode, name }] }`. **`directReports` are the people who still report to the leaver and have no active manager now**; the screen should show them and send HR to the reporting hierarchy (#23). Their `manager_id` is kept as it was.

## Open items are flagged, not changed

Other modules own their open items and react to `employee.deactivated`: tasks reassignment (D-19 step 2) and notifications arrive with those modules. This module reads only the employee and account tables. **Known gap:** a pending approval waiting on the deactivated person as the requester's manager cannot be decided by anyone until HR re-routes it (the engine has no re-route yet; decision still open with the TL).

## Not built

The offboarding checklist (D-19 steps 1 to 5), a last working day and a scheduled future deactivation. This endpoint is the "deactivate now" action the checklist ends with.
