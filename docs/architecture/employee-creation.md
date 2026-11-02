# Employee creation

Issue #20 (backend; the creation form is Dev 1's). `POST /api/v1/employees` creates an employee, the sign-in account and the role in one step. Rules: D-20 (onboarding), G-04 (every user has exactly one employee), role matrix (HR assigns a role only when creating an employee).

## API

`POST /employees`, permission `employees.create` (Admin, HR Manager). The `Idempotency-Key` header is required; a retry with the same key returns the first response.

| Field                                                           | Rule                                                                         |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `employeeCode`                                                  | 2 to 50 characters: letters, digits, `-`, `_`. Unique, case-insensitive      |
| `firstName`, `lastName`                                         | 1 to 100 characters, trimmed                                                 |
| `email`                                                         | Stored lower case. Unique across employees and accounts. It is the sign-in name |
| `phone`                                                         | Optional. Digits, spaces, `+ ( ) -`                                          |
| `departmentId`, `designationId`                                 | Both active, and the designation belongs to the department                   |
| `managerId`                                                     | Optional. An **active** employee                                             |
| `joiningDate`                                                   | `YYYY-MM-DD`, a real date, at most 365 days ahead                            |
| `role`                                                          | `staff` (default), `team_lead`, `hr_manager` or `admin`                      |

Unknown fields are rejected (400), so `status`, `isActive` or a password can never be sent. Answers: **201** with the new employee (status `pending`, no credentials); **403** when an HR Manager asks for the `admin` or `hr_manager` role (only an Admin hands those out); **409** for a repeated code or email; **422** when the department, designation or manager is missing, inactive or does not match, with the field named.

## What happens

One database transaction: the referenced department, designation and manager are read under a share lock (so none can be deactivated mid-create), the duplicates are checked, then the employee (status `pending`), the user (**inactive**) and the role are inserted and the audit entry is written in the same transaction. Any failure leaves nothing behind. The unique indexes on code and email are the backstop when two requests race.

The account is created inactive with the hash of a random password nobody knows, so it cannot sign in. The employee gets in through the onboarding flow (#24), which activates the account and sends the set-password link; that link is a new auth surface and goes to the TL for design review first.

After the commit: the `employee.created` event (ids only) and a welcome email through the outbox, with the dedupe key `employee:{id}:welcome`. The email has no password and no link. A failure to queue it is logged and does not undo the creation; the dedupe key makes a resend safe.

The audit entry `employee.create` holds ids, the employee code, the role and the status, never names or the email. A refused attempt is audited as `failure`.

## Not covered here

The set-password link and activation (#24), default leave balances and the default shift (they arrive with their own modules and subscribe to `employee.created`), reading and updating an employee (#21), and the manager hierarchy rules (#23).
