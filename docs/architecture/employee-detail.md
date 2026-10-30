# Employee detail and edit

Issue #21 (backend; the detail page with tabs is Dev 1's). `GET` and `PUT /api/v1/employees/{id}`.

## Reading: `GET /employees/{id}`

Permission `employees.read`: Admin and HR Manager see any employee, a Team Lead their direct reports, Staff only themselves. Anyone else gets **404, identical to an unknown id**. The response is the employee with department, designation and manager, the `status`, the `joiningDate`, and a `version`.

**Login information** (`account`: user id, active flag, last login, roles) is part of the response only for callers who may edit employees (Admin, HR Manager). A Team Lead or the employee themselves never receive it, and the password hash is never selected. The catalog has no ID-document, bank or compensation fields yet; when they are added they follow the rule in the role matrix (a separate permission, left out of default responses).

## Editing: `PUT /employees/{id}`

Permission `employees.update` (Admin, HR Manager). Send only the fields to change and the `version` you read.

| Field                                                                | Who may change it |
| -------------------------------------------------------------------- | ----------------- |
| `firstName`, `lastName`, `phone` (`null` clears it), `joiningDate`   | Admin, HR Manager |
| `departmentId`, `designationId`                                      | Admin, HR Manager |
| `employeeCode`, `email`                                              | **Admin only** (403 for HR) |
| `status`, `managerId`, role, user id                                 | Not here: the body is strict, so they are a 400 |

- **Status** changes belong to onboarding (#24) and deactivation (#26), **managers** to the reporting hierarchy (#23, which prevents cycles), **roles** to `PUT /users/{id}/roles` (#27).
- A department and designation are validated **together** (both active, the designation belongs to the department). Moving an employee to another department therefore needs a designation of that department in the same request.
- A **deactivated** employee cannot be edited (422).
- `email` is stored lower case and is also written to the employee's sign-in account in the same transaction. Code and email must stay unique, whatever the letter case (409); the employee's own record is not counted as a clash.
- Sending values that already match writes nothing: no new version, no audit entry, no event.

## Concurrency

Every row of `employees` has a `version`, bumped (with `updated_at`) by a database trigger on **every** update, so no code path can forget and no client can set it by hand. An edit sent with an older `version` is refused with **409**; the client reloads and tries again. The edit runs under `SELECT … FOR UPDATE`, so two edits made at the same moment run one after the other: one succeeds, the other gets the 409 (tested against real PostgreSQL with both requests inside their transactions at once).

## Audit and events

`employee.update` is written in the same transaction as the change. It holds the **names of the fields** that changed and, for a department or designation change, the old and new **ids**. Names, email and phone values are personal data and are never recorded. A failed or refused attempt is audited as a failure. After the commit, `employee.updated` (employee id and field names) is emitted.

## For the next issues

`/employees/me` (#22) must be registered **before** the `/:id` router, otherwise `me` is read as an id (it would answer 400 now). Migration `20261030000014_employees_version.sql` adds the column and trigger; `employees` is a shared table reviewed by the Technical Lead.
