# Authentication and Sessions

Decision record: [D-05](decisions/D-05-authentication-and-sessions.md). Code: `apps/api/src/modules/auth/`.

## For the web app
| Call | Purpose |
|---|---|
| `POST /api/v1/auth/login` `{ email, password }` | Signs in. Sets the `maxr_session` cookie and returns `{ data: { user, csrfToken } }` (`user` has `id`, `employeeId`, `email`, `firstName`, `lastName`, `role`, `roles`, `permissions`). `401` generic message; `429` + `Retry-After` when locked or rate limited. |
| `GET /api/v1/auth/me` | The current session (same body as login). Call it on page load: `401` means show the sign-in screen. |
| `POST /api/v1/auth/logout` | Ends the session (`204`). |
| `POST /api/v1/auth/change-password` `{ currentPassword, newPassword }` | `204`; ends the user's other sessions. `403` wrong current password, `422` new password not allowed. |

- Use `fetch(url, { credentials: 'include' })`. The browser sends the cookie; JavaScript never sees it.
- Keep `csrfToken` **in memory** (not `localStorage`) and send it as `X-CSRF-Token` on every `POST`, `PUT` and `DELETE`. After a page reload, get it again from `GET /auth/me`.
- `permissions` is only for showing or hiding UI. The server checks permissions on every request (`requirePermission`, see [rbac.md](rbac.md)). The list is computed from the code catalog, not read from the database.

## For module authors (backend)
```ts
// routes/index.ts mounts each module router with `auth.authenticate` in front of it:
router.use('/employees', auth.authenticate, createEmployeesRouter(...));

// inside a controller or service the caller is always the session's user, never the request body:
const { id, employeeId, role, roles } = req.actor!;
```
- **Never** read the user, employee, role or team from a header, body or query string. `req.actor` is set only by `authenticate`.
- `authenticate` also checks the CSRF token and browser origin for POST, PUT and DELETE.
- Permission checks (`requirePermission`) and record-scope filters sit right after `authenticate`; see [rbac.md](rbac.md).
- To end a user's sessions (deactivation, security incident): `auth.sessions.revokeAllForUser(userId)`.
- Audit actions written by this module: `auth.login`, `auth.login_failed` (with a `reason`), `auth.logout`, `auth.password_changed`, `auth.password_change_failed`. Passwords, tokens and CSRF tokens are never logged.

## Configuration
| Variable | Default | Meaning |
|---|---|---|
| `SESSION_MAX_AGE_MS` | 86400000 (24 h) | Absolute session lifetime |
| `SESSION_IDLE_TIMEOUT_MS` | 7200000 (2 h) | Sign out after this long without a request (capped at the lifetime) |
| `LOGIN_MAX_FAILURES` / `LOGIN_LOCKOUT_WINDOW_MS` | 5 / 900000 | Failed attempts per account before it is locked, and the window |
| `LOGIN_RATE_LIMIT_MAX` / `LOGIN_RATE_LIMIT_WINDOW_MS` | 10 / 900000 | Requests to `/auth/login` per IP |
| `AUTH_COOKIE_SECURE` | `true` in production | Must be `true` in production (the API refuses to start otherwise) |
| `CORS_ORIGIN` | `http://localhost:3000` | The one web origin allowed to send state-changing requests |

## Testing
- `*.http.test.ts` run on every PR with in-memory stores (`auth.testing.ts` has four users, one per role, and a movable clock). `makeApp()` gives you `authKit` to sign in as any role.
- `*.db.test.ts` run in the Database job against real PostgreSQL and Redis: the SQL repository, the Redis store (same contract suite as the in-memory one) and a full sign-in with the four development users from `npm run db:seed` (password in `docs/development/local-setup.md`).
