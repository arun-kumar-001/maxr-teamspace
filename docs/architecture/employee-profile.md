# My profile

Issue #22 (backend; the profile page is not built yet). `GET` and `PUT /api/v1/employees/me`: the signed-in employee's own record.

## Reading

`GET /employees/me`, permission `profile.read` (every role). It returns the same employee object as `GET /employees/{id}` (#21), including the `version` to send back on edit. The record is always the caller's own: the request carries no id, so there is nothing to point at someone else. It works for a Team Lead too, whose `employees.read` team scope does not include themselves. Admin and HR also receive the `account` block (login information), as they do on the detail route.

## Editing

`PUT /employees/me`, permission `profile.update` (every role). Body `{ version, phone }`; `phone: null` clears it.

**The phone number is the only field an employee can change.** The body is strict, so every other key (role, roles, manager, employee code, status, department, designation, email, name, joining date, a user or employee id, an active flag) is rejected with **400**, not silently ignored: a mass-assignment attempt is visible in the response and changes nothing. A stale `version` is a 409. A value that already matches writes nothing (no new version, no audit entry).

New self-editable fields (a photo once the storage adapter is in use, emergency contacts when the business provides them) are added to `profile.schemas.ts` one at a time, on purpose.

It reuses the employee detail service with a scope that is the caller only, so validation, the row lock, the version check and the audit are the same code as an HR edit. The audit entry `employee.update` names the field (`phone`) and never the number.

## Wiring

`/employees/me` is registered **before** the hierarchy and detail routers; a test lists the composed app's routes and fails if `me` or `org-roots` come after `/employees/:id`. Migration `20261030000015_rbac_profile_permissions.sql` adds the two catalog keys.
