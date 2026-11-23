# Reporting hierarchy

Issue #23 (backend; the org chart and the manager picker are Dev 1's). Decisions: D-11 and D-26 (a team is a person's **direct reports**, found through `employees.manager_id`).

## Changing a manager: `PUT /employees/{id}/manager`

Permission `employees.update` (Admin, HR Manager). Body `{ version, managerId }`; `managerId: null` removes the manager. The body is strict: nothing else about the employee can be changed here (the rest of the profile is `PUT /employees/{id}`, #21).

| Rule                                                                                         | Answer |
| -------------------------------------------------------------------------------------------- | ------ |
| The manager is the employee, or **reports to the employee, directly or through others** (a loop) | 422    |
| The manager does not exist, or is not an **active** employee                                 | 422, naming `managerId` |
| The employee is deactivated                                                                  | 422    |
| `version` is stale (someone else changed the employee)                                       | 409    |
| The employee is unknown or outside the caller's scope                                        | 404    |
| The employee already has this manager                                                        | 200, nothing written, no audit, no event, version unchanged |

The change runs in one transaction with the audit entry `employee.manager_change` (ids only: old and new manager) and sends `employee.manager_changed` after the commit.

**Why there is one lock for the whole tree.** The loop check reads other people's rows. Row locks happen to serialise two people moving under each other, but not a longer loop: with `q` under `p` and `s` under `r`, moving `p` under `s` while `r` moves under `q` touches four different rows, both checks pass, and `p > s > r > q > p` is created. So every change first takes a transaction-level advisory lock for the reporting tree. A test commits exactly that four-person case and fails if the lock is removed. The walk up the tree uses `UNION`, so a loop that is already in the data cannot make it run forever.

## Reading the tree

| Route                                  | Permission       | Result |
| -------------------------------------- | ---------------- | ------ |
| `GET /employees/org-roots`             | `employees.list` | The people at the top: no manager, not deactivated (`status=deactivated` lists leavers) |
| `GET /employees/{id}/direct-reports`   | `employees.list` | That employee's direct reports, not deactivated unless `status` says otherwise |

Both are paginated (`page`, `pageSize`, `status`) and return nodes `{ id, employeeCode, name, designation, status, directReportCount }`. **`directReportCount` counts people who are not deactivated**, so the chart knows whether a node can be opened and agrees with what opening it shows. The UI loads the chart **one level at a time**: roots first, then `direct-reports` for the node the user opens.

Scope applies to every row. Admin and HR see the company. A Team Lead sees no roots (their team reports to them) and may open their own `direct-reports` (the caller is always allowed to ask about themselves) or the branch of someone in their team. Anyone else's branch is a 404, the same as an unknown id. Staff cannot use these routes.

## Team scope and the tree

Team scope is a live SQL condition on `manager_id`, with nothing cached, so a change takes effect for every scope check at once. Contract tests run the real directory query: after a move the employee leaves the old manager's team and joins the new one; removing the manager clears the team; and the reports of a **deactivated** manager (who keep their `manager_id`, #26) belong to the new manager as soon as HR reassigns them. A pending approval whose current step is "the requester's manager" also follows this: it is decided by whoever is the manager when the decision is made, which is how HR unsticks the approvals of a leaver's team.

## Not here

Bulk reassignment of a leaver's whole team in one call (the UI sends one request per person), and rules such as a maximum depth.
