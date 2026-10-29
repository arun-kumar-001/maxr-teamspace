# OWASP ASVS 4.0.3 (Level 2) Checklist: working subset

Status: **Done** (code/test exists in `develop`), **Planned** (owner issue), **Decision**, **N/A**. Review at every milestone; the TL signs off before launch (#16).

| ASVS | Requirement (short) | Status | Evidence / owner |
|---|---|---|---|
| V1.1 | Threat model and secure design documented | Done | `threat-model.md` |
| V2.1 | Password policy (length ≥ 12, no composition rules, breached check optional) | Decision | D-05; #7 |
| V2.4 | Passwords hashed with Argon2id / bcrypt ≥ 12 | Planned | #7 |
| V2.2 | Anti-automation on login (rate limit, lockout) | Planned | #7; limiter exists (#58) |
| V2.8 | MFA for privileged roles | Decision | Not in report; recommend for Admin and HR |
| V3.2 | New session token on login; invalidated on logout | Planned | #7 |
| V3.3 | Session timeout, idle and absolute | Decision | D-05 |
| V3.4 | Cookies: httpOnly, Secure, SameSite | Planned | #7 |
| V3.7 | Deactivation / password change ends all sessions | Planned | #26, #7 |
| V4.1 | Access control enforced on a trusted server layer | Planned | #8; every endpoint |
| V4.2 | IDOR protection, record-scope in queries | Planned | #8; per-module cross-scope tests |
| V4.3 | Admin interfaces protected | Planned | #27 |
| V5.1 | Input validated with allow-list schemas | Done | Zod `validate()` (#58) |
| V5.3 | Output encoding; no raw HTML from user data | Planned | UI review rule; `ui-hex-regression`-style lint checks later |
| V5.3.4 | Parameterised queries | Done | Repository rule; DB client (#6) |
| V6.1 | Sensitive data classified; encrypted at rest | Decision | `data-protection-and-retention.md`; D-10, D-25 |
| V7.1 | No sensitive data in logs | Done | Redaction tests (#58) |
| V7.2 | Security events logged (auth, access denied, changes) | Planned | Audit service Done (#60); events added per feature |
| V7.3 | Log integrity | Done | Append-only audit table (#60) |
| V8.1 | Sensitive data not cached by the browser/proxy | Planned | `Cache-Control: no-store` on sensitive responses #16 |
| V9.1 | TLS for all traffic | Planned | Nginx #17 |
| V10.3 | Dependencies checked and patched | Done / Planned | `npm audit` prod blocking (#57); dev audit blocking after #52 F7 |
| V11.1 | Business logic limits, anti-replay | Done / Planned | Idempotency (#58); constraints in migrations |
| V12.1 | File upload: type, size, content checks | Done | Storage service (#60) |
| V12.3 | Path traversal / filename safety | Done | Server-generated keys, sanitised names (#60) |
| V12.5 | Files served with safe headers, authorised access | Done | Signed, user-bound links (#60) |
| V12.4 | Malware scanning of uploads | Planned | Hook Done (fail closed); scanner integration #16 |
| V13.1 | API: schema validation, correct HTTP verbs, versioned | Done | `/api/v1`, OpenAPI sync test (#58) |
| V13.2 | Generic error messages, no stack traces | Done | Error envelope (#58) |
| V14.1 | Build and deploy pipeline secure; secrets not in repo | Done | CI, gitleaks (#57) |
| V14.2 | Dependencies pinned via lockfile | Done | `npm ci`, lockfile guard |
| V14.4 | Security headers (CSP, X-Content-Type-Options, frame-ancestors, Referrer-Policy) | Planned | #16 |
| V14.5 | CORS restricted to known origins | Planned | #16 |

Open items to close before launch: all rows not "Done"; TL signs the table in the #16 PR.
