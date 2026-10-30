# Authorization: permissions and record scope

Issue #8. Deny by default: a request is allowed only when one of the user's roles holds the route's permission, and the data it reaches is narrowed to the scope that role holds. Hiding UI is cosmetic only.

## The pieces (`apps/api/src/modules/rbac`)

| File                    | Purpose                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `permission-catalog.ts` | The single catalog: `module.action` → description and, per role, the **record scope** (`own`, `team`, `hr`, `all`). A role with no entry is denied. Typed keys: a typo is a compile error. |
| `scope.ts`              | `resolveScope` (widest scope across a user's roles), `toScopeFilter` (scope → repository filter), `scopeToSql` and `scopeAllows` (the SQL and in-memory form of the same filter).          |
| `require-permission.ts` | `requirePermission('module.action')`, `publicRoute()`, `authenticatedOnly()`, `accessFor(req)`.                                                                                            |
| `rbac.testing.ts`       | Test utilities: `signInAs`, `agentAs`, `expectNoExistenceLeak`, `listRoutes`. Not shipped in the build.                                                                                    |

Database rows (`roles`, `permissions`, `role_permissions`) are reference data from migration `20261030000001_rbac_reference_data.sql`. `rbac-reference-data.test.ts` fails if they differ from the code catalog, so a permission change is one catalog edit plus one migration.

## Writing a route

```ts
router.get(
  '/',
  authenticate, // 401 without a session
  requirePermission('employees.list'), // 403 without the permission; sets req.access
  validate({ query: listQuerySchema }),
  asyncHandler(controller.list),
);
```

The controller passes `accessFor(req).filter` to the service and the service to the repository. The filter parameter is **required** on repository reads, so forgetting it does not compile.

```ts
// Repository (SQL): the scope goes into the query, never applied after fetching.
const scope = scopeToSql(filter, 'e.id', params.length + 1);
const rows = await pool.query(`SELECT ... FROM employees e WHERE e.is_active AND ${scope.clause}`, [
  ...params,
  ...scope.values,
]);
```

For a single record outside the scope the repository returns nothing and the service throws `notFound`: out of scope looks exactly like "does not exist".

## Scopes

| Scope       | Filter                                            | Meaning                                                                                                                        |
| ----------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `own`       | `column = caller's employee id`                   | The caller's records                                                                                                           |
| `team`      | `column IN (employees whose manager_id = caller)` | Direct reports, not recursive, **not the caller** (decision D-23, D-11)                                                        |
| `hr`, `all` | none                                              | Every employee's records. HR and Admin differ in which **permissions** they hold (audit logs, security), not in the row filter |
| none        | `FALSE`                                           | Anything unknown or missing narrows to nothing; it never widens                                                                |

A user with several roles gets the widest scope per permission.

## Route markers and the CI check

Every route carries exactly one of `requirePermission(...)`, `publicRoute()` or `authenticatedOnly()` (any signed-in user, for own session and password). `route-inventory.test.ts` lists every registered route and fails when one has none, and keeps the set of public routes an explicit reviewed list: health, login, signed file download, and the OpenAPI document (development only).

## Tests every module writes

Use the utilities in `rbac.testing.ts` (see `modules/_template/template.access.test.ts`):

1. 401 on every route without a session.
2. A table of role × route → expected status (allowed 2xx, denied 403).
3. Scope: each role lists only its own records; reading someone else's record is 404 and identical to a missing id (`expectNoExistenceLeak`).
4. A scope SQL check against real PostgreSQL when the module adds its own queries (`modules/rbac/scope.db.test.ts` is the pattern).

## Not covered here

Per-field rules (sensitive fields need an explicit permission), the "no self-approval" rule (D-12) and field-level mass-assignment limits belong to the module that owns them. Permission denials are not audited yet; add that when the audit catalog for security events is agreed.

## Keys for attendance, shifts and approvals

Added for #33, #35 and #37 (migration `20261030000006`). Scope is what the repository filter enforces.

| Route (suggested)                                                                 | Permission                                                           | Admin | HR  | Team Lead | Staff |
| --------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----- | --- | --------- | ----- |
| `POST /attendance/check-in`, `check-out`; `GET /attendance/active`, `today`, `me` | `attendance.check_in`, `attendance.check_out`, `attendance.read_own` | own   | own | own       | own   |
| `GET /attendance` (list others)                                                   | `attendance.list`                                                    | all   | all | team      | none  |
| `GET /shifts`, `GET /shifts/{id}`                                                 | `shifts.list`                                                        | all   | all | all       | all   |
| `GET /shifts/assignments/{employeeId}`                                            | `shifts.read_assignment`                                             | all   | all | team      | own   |
| `POST /shifts`, `PUT /shifts/{id}`                                                | `shifts.create`, `shifts.update`                                     | all   | all | none      | none  |
| `POST /shifts/assignments`                                                        | `shifts.assign`                                                      | all   | all | none      | none  |
| `GET /shifts/policies`                                                            | `attendance_policies.read`                                           | all   | all | all       | all   |
| `PUT /shifts/policies`                                                            | `attendance_policies.update`                                         | all   | all | none      | none  |
| `GET /approvals`, `GET /approvals/{id}`                                           | `approvals.list`, `approvals.read`                                   | all   | all | team      | own   |
| `POST /approvals`                                                                 | `approvals.create`                                                   | own   | own | own       | own   |
| `POST /approvals/{id}/approve`, `reject`                                          | `approvals.decide`                                                   | all   | all | team      | none  |

The requester of an approval is always the caller's own employee id. The "no self-approval" rule stays in the approvals service. Take any further key to the TL: this file and `permission-catalog.ts` are TL-approved.
