# ADR D-05: Authentication Mechanism & Revocable Session Strategy

- **Status:** Approved
- **Deciders:** Technical Lead (`arun-kumar-001`)
- **Date:** 2026-10-29 (proposal 2026-10-28)
- **Context:** [Product Baseline §10 (D-05)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §7](../../../AGENTS.md), [auth.md](../auth.md)

---

## Context and Problem Statement

Figure 1 of the specification suggests "JWT / OAuth2", whereas the approved specification text requires a "secure session token" and mandates that **deactivating an employee must immediately end all active login sessions** (T§5.1).
Stateless JWT tokens cannot be revoked instantly without a denylist, and tokens kept in browser `localStorage` are exposed to XSS.

## Decision Drivers

1. **Immediate revocation on deactivation** (specification T§5.1).
2. **XSS and CSRF defence:** credentials only in `httpOnly`, `Secure`, `SameSite` cookies; a CSRF token for state-changing requests.
3. **Auditability:** every sign-in, failure, sign-out and password change is audited.
4. **Brute force protection:** per-IP rate limit and per-account lockout on `POST /auth/login`.
5. **Simplicity:** one store, no table to keep in sync.

## Decision (approved by the Technical Lead on 2026-10-29)

1. **Sessions live in Redis only.** (The original proposal also had a `sessions` table; it is dropped.)
   - A session is an opaque 32-byte random token in the `maxr_session` cookie (`HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/api`).
   - Redis stores `SHA-256(token)` → `{ userId, csrfToken, createdAt }` with a time to live, plus a per-user set of session hashes for revocation. A leaked Redis dump holds no usable tokens.
   - **Idle timeout** 2 h (`SESSION_IDLE_TIMEOUT_MS`), renewed by activity, and **absolute lifetime** 24 h (`SESSION_MAX_AGE_MS`), never extended.
   - Redis runs with append-only persistence, so a restart keeps sessions; if Redis is lost, users sign in again (accepted).
2. **Deactivation and role changes take effect immediately.** `authenticate` loads the account from PostgreSQL on every request (primary-key lookup) and rejects inactive users, non-active employees and users without a role, ending their sessions. `SessionService.revokeAllForUser(userId)` is the hook for `POST /employees/{id}/deactivate` (#26) and password change.
3. **Passwords:** Argon2id (`@node-rs/argon2`, prebuilt binaries, no compiler needed): 64 MiB memory, 3 passes, 1 lane. One lane keeps a burst of logins from taking every core; the OWASP minimum is 19 MiB with 2 passes. Policy: 12 to 128 characters, no composition rules, not the email, not equal to the current password, a short denylist of obviously weak ones (a breached-password check is a later hardening step, #16). Unknown emails are verified against a dummy hash so timing does not reveal accounts.
4. **Brute force:** `POST /auth/login` is limited to 10 requests per IP per 15 minutes, and an account (any identifier, existing or not) is locked after 5 failed attempts in 15 minutes (`login_attempts` table), answered with `429` and `Retry-After`; a successful sign-in resets the count. Every failure returns the same `401 Invalid email or password`.
5. **CSRF:** the CSRF token is returned by `login` and `me` (not in a cookie) and must be sent in `X-CSRF-Token` on every POST, PUT and DELETE; the `Origin` header, when present, must equal the web app origin. These sit on top of `SameSite=Lax`.
6. **Out of scope for now:** MFA, SSO, password reset by email, "remember me", a device/session list screen. Add them by new ADR.

## Consequences

### Positive

- Instant revocation satisfies the core requirement.
- No token reaches JavaScript (XSS cannot steal the session) and CSRF is blocked in three layers.
- One session store and no extra table; the session service has in-memory and Redis implementations behind one contract test.

### Negative / trade-offs

- Every authenticated request costs one Redis read and one PostgreSQL read.
- Mobile apps or third-party integrations (if added later) need dedicated revocable API keys or OAuth2 tokens, not this cookie.
- Losing Redis signs everyone out.
