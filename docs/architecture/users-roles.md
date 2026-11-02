# Users and roles API

Issue #27 (backend half; the Admin pages are Dev 1's). Decision D-21: the four roles and the permission catalog are fixed in code, so these endpoints read them and assign roles to accounts; nothing edits a role or a permission.

## API

| Route                   | Permission          | Who               | Notes                                                                                                                                                          |
| ----------------------- | ------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /users`            | `users.list`        | Admin, HR Manager | Paged. `search` (name, email, employee code), `role`, `isActive`, `sortBy` (`name`, `email`, `createdAt`, `lastLoginAt`), `sortOrder`. Ties are ordered by id. |
| `GET /users/{id}`       | `users.read`        | Admin, HR Manager | 404 for an unknown id                                                                                                                                          |
| `PUT /users/{id}/roles` | `users.assign_role` | **Admin only**    | Body `{ "roles": [...] }`, the complete set (1 to 4, no repeats)                                                                                               |
| `GET /roles`            | `roles.list`        | Admin             | The four roles with the number of **active** accounts holding each                                                                                             |
| `GET /permissions`      | `permissions.list`  | Admin             | Catalog: key, module, action, description, `grants` (role -> scope)                                                                                            |

An account is returned as `id`, `employeeId`, `employeeCode`, `name`, `email`, `isActive`, `roles`, `lastLoginAt`, `createdAt`. The password hash is never selected. `GET /permissions` is built from the catalog in code, which is the authority; the database rows only mirror it.

## Changing roles

- The body replaces the whole role set. Sending the roles the account already has is a 200 with no change and **no audit entry**.
- **The last active Admin cannot lose the Admin role** (422). An inactive Admin does not count as a remaining Admin. The check and the write run in one transaction that first locks the `admin` role row, so two Admins demoting each other at the same moment cannot both succeed.
- Every change is audited as `users.assign_role` (`entityType` `user`, `changes.roles.from` and `to`); a refused or failed attempt is audited with outcome `failure`.
- Roles are read from the database on every request, so a change applies to the account's open sessions on its next request. Sessions are therefore **not** revoked on a role change; deactivation (#26) still ends them.
- HR Manager is denied (403). Creating an employee assigns the initial role inside that flow (role matrix: "at employee creation"), not through this route.

## Not covered

Deactivating or creating accounts belongs to the employee module (#20, #26). Reading accounts is not audited.
