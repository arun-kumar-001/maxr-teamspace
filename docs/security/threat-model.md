# Threat Model

**Scope:** MAXR Teamspace web app, API, PostgreSQL, Redis, file storage (Cantobo, D-10), email adapters. **Method:** STRIDE per trust boundary. **Status:** v1 draft for TL approval; revisit at each milestone and when D-05 (auth) and D-10 (storage) close.

## 1. Assets (what an attacker wants)
| Asset | Sensitivity | Where |
|---|---|---|
| Employee identity documents, bank details, compensation | Highest | `employee_documents`, employee fields; Cantobo storage |
| Personal data (name, contact, address, DOB) | High | `employees` |
| Credentials and sessions | High | `users` (password hash), session store (D-05) |
| Leave, attendance, performance-related records | Medium | operational tables |
| Audit log | Integrity-critical | `audit_logs` (append-only) |
| Secrets (DB, SMTP, SendGrid, signing secrets) | Highest | environment / secret store |

## 2. Actors
Anonymous internet user; authenticated Staff, Team Lead, HR Manager, Admin (malicious or curious insider); compromised account; compromised dependency; operator with host access.

## 3. Trust boundaries
1. Browser ↔ Nginx (TLS). 2. Nginx ↔ API. 3. API ↔ PostgreSQL / Redis. 4. API ↔ file storage. 5. API ↔ email/SMS providers. 6. CI/CD ↔ production host.

## 4. Threats and controls

| ID | Threat (STRIDE) | Control | Status |
|---|---|---|---|
| T1 | **Broken access control / IDOR**: a user reads or edits another user's or team's record (E, I) | Deny by default; role **and** record scope applied inside repository queries; out-of-scope reads return 404; cross-scope tests per role (`AGENTS.md` §5, §7, §10) | Planned: RBAC engine #8; tests in every feature PR |
| T2 | **Privilege escalation via mass assignment** (client sends `role`, `managerId`, `status`) (E) | Strict Zod schemas reject unknown keys; never trust client `userId`/role/team; allowed-field whitelists for `/employees/me` | Done: strict schemas in API conventions (#58); Planned: per-endpoint tests |
| T3 | **Credential stuffing / brute force on login** (S) | Rate limit and lockout/backoff on `POST /auth/login`; generic failure message; Argon2id or bcrypt ≥ 12 | Done: rate-limit helper (#58); Planned: auth #7, decision D-05 |
| T4 | **Stolen or fixed session** (S, E) | httpOnly+Secure+SameSite cookies, short-lived tokens, rotation on login, revoke all sessions on deactivation and password change | Decision D-05; Planned #7, #26 |
| T5 | **CSRF** when cookie auth is used (T) | SameSite plus CSRF token for state-changing requests | Planned #7 |
| T6 | **Injection (SQL, header, log)** (T) | Parameterised queries only; validated `x-request-id`; output encoding; no `dangerouslySetInnerHTML` with user data | Done: DB error mapping, logger redaction; Planned: request-id validation (#52 F5) |
| T7 | **XSS** (T, I) | React escaping, CSP header, no inline user HTML | Planned #16 (headers/CSP) |
| T8 | **Malicious file upload** (T, D) | Type/size allow-list, content sniffing (PDF/PNG/JPEG), server-generated keys, sanitised filenames, fail-closed virus-scan hook | Done: storage service (#60); Planned: scanner integration #16 |
| T9 | **Unauthorised file download / link sharing** (I) | Private storage; access only via short-lived (≤ 900 s), user-bound HMAC links after an authorisation check | Done: #60; Decision D-10 for provider |
| T10 | **Sensitive data leaks in logs, errors or health output** (I) | Key- and text-based redaction, no query string or body in request logs, no stack traces in responses, health returns only up/down | Done: #58, #60 (tested) |
| T11 | **Tampering with or deleting audit history** (T, R) | Append-only `audit_logs`, audit write fails closed, no write API, Admin-only read | Done: audit service (#60); Planned: viewer #28 |
| T12 | **Repudiation of approvals** (R) | Audit every approval, role change, deactivation, export, login failure; actor + request id | Planned in each feature PR |
| T13 | **Double submit / replay** (check-in, approval) (T) | `Idempotency-Key` per user, 409 on duplicates, DB constraints (one open attendance session) | Done: idempotency helper (#58); Planned: #34, #37 |
| T14 | **Lost update / race on leave balance** (T) | Single transaction, row lock on balance, CHECK constraints | Planned #40 |
| T15 | **DoS / resource exhaustion** (D) | Nginx and API rate limits, body size limit (413), pagination max 100, upload size cap | Done: API limits (#58); Planned: Nginx #17 |
| T16 | **Vulnerable dependencies / supply chain** (T) | `npm audit` (prod blocking), lockfile guard, gitleaks, pinned Actions by SHA later | Done: CI (#57, lockfile guard); Planned: dev-dependency audit blocking (#52 F7), SHA pinning #16 |
| T17 | **Secrets in repo or weak placeholders in production** (I) | Secrets only from environment; production boot refuses placeholder secrets and non-durable stores | Done: platform production checks (#60); Planned: placeholder guard (#52 F6) |
| T18 | **Deactivated user keeps access** (E) | Deactivation revokes all sessions; session check rejects inactive users on every request | Planned #26, #7 |
| T19 | **Email abuse / sensitive data in email** (I) | Outbox via adapters; templates carry no sensitive data; after-commit sending | Done: outbox (#60) |
| T20 | **Insider Admin misuse** (E, R) | Last-admin protection, audited role changes, sensitive fields need explicit permission even for Admin | Planned #27 |
| T21 | **Host or container compromise** (E) | Non-root containers, private network for DB/Redis, ports bound to localhost in dev, backups encrypted | Planned #17 |
| T22 | **Backup theft or untested restore** (I, D) | Encrypted backups, restore drill | Planned #17 |

## 5. Residual risks to accept explicitly (TL decision)
1. Until D-05 closes, the auth design is unproven; T3-T5 stay open.
2. Until D-10 closes, storage encryption at rest and backups are unspecified.
3. Payslip data source (D-16) is unknown, so its protection cannot be designed yet.
4. Shared Admin accounts and MFA are not specified in the report (no MFA yet; recommend MFA for Admin and HR before launch).
