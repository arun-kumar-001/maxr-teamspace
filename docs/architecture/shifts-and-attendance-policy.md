# Shifts and attendance policy

Issue #33 (backend; the HR policy screen is not built yet). Decision D-13: shifts, date-effective assignments, the company timezone and the policy numbers.

## Shifts

| Route                | Permission     | Who                       |
| -------------------- | -------------- | ------------------------- |
| `GET /shifts`, `GET /shifts/{id}` | `shifts.list`   | Every signed-in role      |
| `POST /shifts`       | `shifts.create` | Admin, HR Manager (`Idempotency-Key` required) |
| `PUT /shifts/{id}`   | `shifts.update` | Admin, HR Manager         |

A shift has a `code` (unique, any letter case; never changes), a `name`, a `startTime` and an `endTime` as **company-local `HH:MM`**, and `graceMinutes` (0 to 240, default 15). **`crossesMidnight` is computed by the database**: an end that is not after the start means the shift runs past midnight and belongs to the date it starts. The same start and end is refused. The default shift is **General, 09:00 to 18:00, 15 minutes grace**.

A shift cannot be deactivated while it is the policy's default or while any assignment is still in force (an assignment with no end, or ending today or later, where "today" is the date in the **company timezone**). Past assignments do not block it.

## Assignments

| Route                                   | Permission              | Who                                        |
| --------------------------------------- | ----------------------- | ------------------------------------------ |
| `GET /shifts/assignments/{employeeId}`  | `shifts.read_assignment` | Admin and HR any employee, a Team Lead their team and themselves, anyone themselves; others get 404 |
| `POST /shifts/assignments`              | `shifts.assign`         | Admin, HR Manager (`Idempotency-Key` required) |

Body `{ employeeId, shiftId, effectiveFrom, effectiveTo }`; `effectiveTo` is inclusive and may be `null` (no end). **An employee has at most one shift on any date.** That is enforced by an exclusion constraint in the database (`employee_shifts_no_overlap`), so two requests at the same moment cannot both succeed, as well as by the service:

- a new **open-ended** assignment that starts after the start of the current open-ended one **ends the current one the day before** (leap days included): the normal "from the 1st they work nights";
- any other overlap is a **409** that names the shift and dates in the way, and nothing changes (ending the old assignment is undone if the new one cannot be stored);
- a deactivated employee (422), an unknown employee (404) and a missing or inactive shift (422) are refused; a **pending** employee can be given a shift before they start.

There is no delete: to change course, assign from a later date.

## Policy

`GET /attendance/policies` (every role) and `PUT /attendance/policies` (Admin, HR Manager; audited). One row: **full day** minutes (default 480), **half day** minutes (default 240, always shorter than the full day) and the **default shift** (active), used for an employee who has no assignment on a date. The response also carries the company `timezone` and `workWeek`, which are company settings and are changed there.

## Which shift applies: `ShiftResolver`

`createShifts(...).resolver.shiftOn(employeeId, 'YYYY-MM-DD')` returns the assignment covering that date (both end dates inclusive) or else the default shift. Attendance (late status), leave and reports use it; the caller works out the date in the company timezone, which is where the timezone boundary is decided.

## Audit

`shift.create`, `shift.update` (old and new values), `shift.assign` (with the assignment it ended), `attendance_policy.update` (old and new values). Everything audited here is configuration, not personal data. Each is written in the same transaction as the change.

## Data

Migration `20261030000016_shifts_and_attendance_policy.sql` creates `shifts`, `employee_shifts` and `attendance_policies`, seeds General and the policy row, and enables the `btree_gist` extension (needed for the exclusion constraint; a managed database needs it allowed). The seeded ids are valid v4-shaped UUIDs so strict validation accepts them.
