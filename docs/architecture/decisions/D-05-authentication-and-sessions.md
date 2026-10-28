# ADR D-05: Authentication Mechanism & Revocable Session Strategy

- **Status:** Pending Approval
- **Deciders:** Technical Lead (`arun-kumar-001`)
- **Date:** 2026-10-28
- **Context:** [Product Baseline §10 (D-05)](../../requirements/product-baseline.md#10-decision-register-needs-technical-lead-approval), [AGENTS.md §7](../../AGENTS.md)

---

## Context and Problem Statement

Figure 1 of the specification suggests "JWT / OAuth2", whereas the approved specification text requires a "secure session token" and mandates that **deactivating an employee must immediately end all active login sessions** (T§5.1).
Stateless JWT tokens cannot be revoked instantly without maintaining a distributed denylist, which contradicts simplicity and introduces synchronization latency.
Furthermore, storing authentication tokens in browser `localStorage` leaves tokens vulnerable to Cross-Site Scripting (XSS) attacks.

## Decision Drivers

1. **Immediate Revocation on Deactivation:** Hard requirement from specification T§5.1.
2. **XSS & CSRF Defense:** Secure credential storage in client browsers using `httpOnly`, `Secure`, `SameSite=Lax` cookies.
3. **Auditability:** Complete tracking of active sessions, IP addresses, and user-agent details for compliance and security audit logs.
4. **Brute Force Protection:** Strict rate-limiting and progressive lockout on `POST /api/v1/auth/login`.

## Decision (Pending Technical Lead Approval)

1. **Session Architecture:**
   - Server-side managed sessions with a cryptographically secure random session token (32+ bytes from `crypto.randomBytes`).
   - Active sessions are stored in the database (`sessions` table) and cached in Redis for fast low-latency validation on every API request.
   - Session identifier transmitted via `httpOnly`, `Secure`, `SameSite=Lax` cookies named `maxr_session`.

2. **Session Lifecycle & Deactivation:**
   - When an administrator or authorized HR manager deactivates an employee (`POST /api/v1/employees/:id/deactivate`), all session rows corresponding to that employee's user ID are deleted/revoked atomically from both database and Redis.
   - Subsequent API requests with old session tokens return `401 Unauthorized` immediately.

3. **Password Security:**
   - Passwords hashed using **Argon2id** (recommended parameters: `memoryCost: 65536`, `timeCost: 3`, `parallelism: 4`) or `bcrypt` (cost factor >= 12).
   - Cleartext passwords or password hashes are NEVER logged or returned in API responses.

4. **Rate Limiting & Lockout:**
   - `POST /api/v1/auth/login` is rate-limited to 5 consecutive failed attempts per IP / username within 15 minutes.
   - Consecutive failures trigger progressive lockout and audit log entries (`LOGIN_FAILED`).

## Consequences

### Positive

- Instant session revocation satisfies the core requirement when offboarding or deactivating staff.
- Prevents token exfiltration via client-side script injection (XSS).
- Full visibility of all active sessions for security administration.

### Negative / Trade-offs

- Requires session store lookup (mitigated by fast in-memory Redis caching).
- Mobile apps (if added in the future) or third-party APIs will use dedicated revocable API keys or OAuth2 tokens rather than cookies.

## Status Note

This proposal is currently **Pending Approval** by Technical Lead `arun-kumar-001` prior to implementation in issue `TL-05`.
