# OWASP ASVS 4.0.3 (Level 2) Checklist: working subset

Status: **Done** (code/test exists in `develop`), **Planned** (owner issue), **Decision**, **N/A**. Review at every milestone; the TL signs off before launch (#16).

| ASVS   | Requirement (short)                                                              | Status   | Evidence / owner                                                                                                            |
| ------ | -------------------------------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| V1.1   | Threat model and secure design documented                                        | Done     | `threat-model.md`, ADR D-25                                                                                                 |
| V2.1   | Password policy (length ≥ 12, no composition rules, breached check optional)     | Done     | 12-128 characters, weak-list denylist (`auth.service.ts`, tested in auth suite)                                             |
| V2.4   | Passwords hashed with Argon2id / bcrypt ≥ 12                                     | Done     | Argon2id 64 MiB/3/1 (`password-hasher.ts`, tested)                                                                          |
| V2.2   | Anti-automation on login (rate limit, lockout)                                   | Done     | Per-IP limiter and per-account lockout with `Retry-After` (auth tests)                                                      |
| V2.8   | MFA for privileged roles                                                         | Decision | Not in report; recommend for Admin and HR post-launch                                                                       |
| V3.2   | New session token on login; invalidated on logout                                | Done     | Fresh random token per login; logout revokes it (`auth.service.ts`)                                                         |
| V3.3   | Session timeout, idle and absolute                                               | Done     | 2 h idle, 24 h absolute (D-05)                                                                                              |
| V3.4   | Cookies: httpOnly, Secure, SameSite                                              | Done     | `HttpOnly`, `SameSite=Lax`, `Secure` enforced in production                                                                 |
| V3.7   | Deactivation / password change ends all sessions                                 | Done     | Password change and deactivation calls `revokeAllForUser` (#26, tested in deactivation suite)                               |
| V4.1   | Access control enforced on a trusted server layer                                | Done     | Server-side RBAC and scope on all endpoints; verified in `penetration-audit.test.ts`                                        |
| V4.2   | IDOR protection, record-scope in queries                                         | Done     | Scope applied in queries; out-of-scope returns 404; verified in `penetration-audit.test.ts`                                 |
| V4.3   | Admin interfaces protected                                                       | Done     | Admin-only routes denied to Staff and Team Lead (#27, verified in `penetration-audit.test.ts`)                              |
| V5.1   | Input validated with allow-list schemas                                          | Done     | Zod schemas reject unexpected fields and validate boundaries; tested in `penetration-audit.test.ts`                         |
| V5.3   | Output encoding; no raw HTML from user data                                      | Done     | React auto-escaping, no `dangerouslySetInnerHTML` with user data, token-based design                                        |
| V5.3.4 | Parameterised queries                                                            | Done     | Parameterised queries only; SQL injection payloads tested in `penetration-audit.test.ts`                                    |
| V6.1   | Sensitive data classified; encrypted at rest                                     | Done     | ADR D-25 approved (`D-25-data-retention-and-protection.md`); 5-tier classification matrix                                   |
| V7.1   | No sensitive data in logs                                                        | Done     | Logger redaction of passwords, tokens, and PII; verified in `penetration-audit.test.ts`                                     |
| V7.2   | Security events logged (auth, access denied, changes)                            | Done     | Append-only `audit_logs` service logs auth, role changes, deactivations, approvals                                          |
| V7.3   | Log integrity                                                                    | Done     | Append-only audit table with no update/delete endpoint (`audit_logs`)                                                       |
| V8.1   | Sensitive data not cached by the browser/proxy                                   | Done     | `Cache-Control: no-store` on all API responses (`security-headers.ts`, verified in `penetration-audit.test.ts`)             |
| V9.1   | TLS for all traffic                                                              | Planned  | Nginx TLS termination configured in `deploy/nginx/nginx.conf` (production deployment in #17)                                |
| V10.3  | Dependencies checked and patched                                                 | Done     | `npm audit` zero high/critical vulnerabilities across prod and dev dependencies                                             |
| V11.1  | Business logic limits, anti-replay                                               | Done     | `Idempotency-Key` store, partial unique indexes for attendance sessions, atomic balance updates                             |
| V12.1  | File upload: type, size, content checks                                          | Done     | Magic byte inspection, category policy limits, server-generated storage keys (`storage-service.ts`)                         |
| V12.3  | Path traversal / filename safety                                                 | Done     | Sanitized filenames, path traversal sanitization, storage keys decoupled from client input                                  |
| V12.5  | Files served with safe headers, authorised access                                | Done     | Short-lived (≤ 300s) user-bound HMAC signed download links (`signed-links.ts`, tested in `penetration-audit.test.ts`)       |
| V12.4  | Malware scanning of uploads                                                      | Done     | ClamAV INSTREAM scanner adapter with fail-closed security and EICAR signature detection (`clamav-scanner.ts`, tested)       |
| V13.1  | API: schema validation, correct HTTP verbs, versioned                            | Done     | REST `/api/v1` with Zod schema validation on body, params, and query                                                        |
| V13.2  | Generic error messages, no stack traces                                          | Done     | Standardized error envelope `{ error: { code, message, requestId } }`; no stack leaks in production/test                    |
| V14.1  | Build and deploy pipeline secure; secrets not in repo                            | Done     | GitHub Actions CI, Gitleaks scanning, no secrets committed                                                                  |
| V14.2  | Dependencies pinned via lockfile                                                 | Done     | `npm ci`, lockfile guard (`scripts/check-lockfile.mjs`)                                                                     |
| V14.4  | Security headers (CSP, X-Content-Type-Options, frame-ancestors, Referrer-Policy) | Done     | Nginx web policy (`security-headers.conf`) and API headers (`security-headers.ts`, verified in `penetration-audit.test.ts`) |
| V14.5  | CORS restricted to known origins                                                 | Done     | Explicit origin, credentials allowed, methods and headers restricted (`app.ts`)                                             |

---

## Technical Lead Sign-Off

- **Review Date:** 2026-11-04
- **Reviewer:** Technical Lead
- **Verdict:** **PASSED / SIGNED OFF**
- **Evidence:**
  - Full penetration-style test suite passing in `apps/api/src/security/penetration-audit.test.ts`.
  - Fail-closed ClamAV scanner passing in `apps/api/src/platform/storage/adapters/clamav-scanner.test.ts`.
  - Zero high or critical dependency vulnerabilities (`npm audit --audit-level=high`).
  - Architecture decision D-25 approved and indexed.
  - Production deployment (TLS, rate limits, Cantobo hosting) handed off to Phase 7 launch issue #17.
