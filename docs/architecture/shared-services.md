# Shared Services: Audit, Events, Notifications, Storage (issue #13, TL-11)

**Status:** plan, then implementation on branch `tl/shared-services`. Owner: Technical Lead.
Modules never talk to SMTP, SendGrid, Cantobo or the audit table directly. They receive **interfaces** (dependency injection) and tests use **fakes**. This keeps `AGENTS.md` §3 ("side effects go through an interface with an adapter") true for every module.

## 1. Scope and what is deliberately not in it
| In scope | Not in scope (and why) |
|---|---|
| Audit logger interface, validation, redaction, store interface, logger store, in-memory store | `audit_logs` table and the SQL store: the table is part of issue #6 (Dev 1). The column contract is in §4.1 so #6 can match it |
| Domain-event bus and an after-commit collector | Which events exist and who listens: each module owner (issues #20, #41 and so on) |
| Notification service, outbox, retry/backoff dispatcher, email adapters (SMTP, SendGrid, fake) | Templates, in-app inbox, reminders (issue #41). The SQL outbox table (with #6/#41), contract in §4.3 |
| Storage service (policy, sniffing, scan hook, signed links), local-disk and in-memory adapters, download route | A Cantobo/S3 adapter: the Cantobo API is unknown (**D-10**, §8). It must pass the contract tests in this PR |

## 2. Decisions
| Topic | Decision | Reason |
|---|---|---|
| Email over SMTP | `nodemailer` (the only new runtime dependency) | Standard; points at Mailpit locally |
| Email over SendGrid | Plain HTTPS call with Node's built-in `fetch`, no SDK | Fewer dependencies, easy to test |
| Delivery | **Outbox pattern**: a message is written first, a dispatcher sends it later with retries | A mail-server outage must not fail a business action; nothing is sent for a rolled-back transaction |
| Signed links | Application-issued HMAC-SHA256 tokens, not provider pre-signed URLs | The Cantobo API is unknown (D-10); the same links then work for every adapter |
| File access | Only through a signed, short-lived link created **after** the module's authorization check; always `Content-Disposition: attachment` | `AGENTS.md` §7 |
| Fail-closed in production | App refuses to start with an in-memory outbox/audit store, no signing secret, or no virus-scan hook when scanning is required | A silent fallback would lose audit records or accept unscanned files |
| Config | One new file `platform/platform-config.ts` reads the new variables (as `http-config.ts` does) | Avoids edits in `config/env.ts`, which Dev 1 is changing in the #52 follow-up |

## 3. Layout
```
apps/api/src/platform/
  index.ts                  createPlatform(): wires everything, fail-closed checks
  platform-config.ts        env parsing and validation
  audit/                    types, audit-logger, stores (logger, in-memory), contract tests
  events/                   event-bus, event-collector
  notifications/            types, notification-service, outbox (in-memory), dispatcher, backoff, email-validation,
                            adapters (fake, smtp, sendgrid)
  storage/                  types, upload-policy (+ magic bytes), filename, signed-links, storage-service,
                            adapters (memory, local-disk), files.routes (download)
  contracts/                reusable contract suites: storage, outbox, email adapter
```
Modules import **only** the interfaces (`AuditLogger`, `EventBus`, `NotificationService`, `StorageService`) from `platform/index.ts`.

## 4. Contracts

### 4.1 Audit
`audit.record({ action, entityType, entityId?, outcome, actorId?, actorRole?, requestId?, changes?, metadata? })`
- `action` is `module.verb`, lower-case, for example `employee.deactivate`, `leave.approve`, `auth.login_failed`. `outcome` is `success | denied | failure`.
- The entry gets a UUID and a UTC timestamp. `metadata` and `changes` pass through the redactor (by field name and by secrets inside text) and are capped at 8 KB; oversize is replaced by a marker, never truncated mid-value.
- **Fail closed:** `record()` throws if the store fails, so a caller can abort the business action. `tryRecord()` logs and continues, for non-critical events.
- **Atomic with the change:** `record(event, { transaction })` hands the open database transaction to the store. The SQL store (issue #6) must write the entry inside that transaction, so the audit entry and the data change commit or roll back together. Modules that change data must pass their transaction; the in-memory sample cannot show atomicity because it has no transaction.
- **Append only:** the interface has no update or delete.
- `audit.withContext({ actorId, actorRole, requestId })` returns a logger bound to the current request.
- Stores: `LoggerAuditStore` (JSON line, `audit: true`), `InMemoryAuditStore` (tests). The SQL store arrives with #6.

Contract for the `audit_logs` table (issue #6 should create it; append only, no UPDATE/DELETE grant for the app role): `id uuid pk`, `occurred_at timestamptz not null`, `action text not null`, `outcome text not null check in (success, denied, failure)`, `actor_id uuid null`, `actor_role text null`, `entity_type text not null`, `entity_id text null`, `request_id text null`, `changes jsonb null`, `metadata jsonb null`; indexes on `(occurred_at desc)`, `(actor_id, occurred_at desc)`, `(entity_type, entity_id, occurred_at desc)`.

### 4.2 Events
`bus.emit({ type, payload, actorId?, requestId? })` calls subscribers; a failing subscriber is logged and never affects the caller or other subscribers. `EventCollector` holds events during a transaction: `add()` while working, `flush(bus)` after **commit**, `discard()` after rollback. This is the rule that stops an email being sent for a leave approval that was rolled back.

### 4.3 Notifications
- `notifications.enqueueEmail({ to[], subject, text, html?, dedupeKey? })` validates and writes an outbox item (`pending`). A second call with the same `dedupeKey` returns the existing item (safe retries).
- **Validation** (header-injection and abuse): addresses must be well formed, 1 to 50 recipients, no CR/LF anywhere in subject or addresses, subject max 200 chars, text max 100 KB.
- **Dispatcher** `runOnce(now)`: claims due items with a lock (so two workers never send the same item; a crashed worker's lock expires), sends through the adapter, marks `sent`; on error schedules a retry with exponential backoff (30 s, 60 s, 120 s, …, capped at 1 h) and after 5 attempts marks `dead`. `start()/stop()` runs it on an interval (`OUTBOX_POLL_INTERVAL_MS`).
- **Privacy:** logs contain the outbox id, attempt and status only: never recipients, subject or body. Error text from providers is scrubbed before it is stored.
- Adapters: `FakeEmailAdapter` (records, can be told to fail), `SmtpEmailAdapter` (nodemailer), `SendGridEmailAdapter` (HTTPS, 10 s timeout, API key never in errors).

Contract for the `notification_outbox` table (with #6/#41): `id uuid pk`, `channel text`, `payload jsonb`, `status text (pending, processing, sent, dead)`, `attempts int`, `next_attempt_at timestamptz`, `locked_until timestamptz null`, `last_error text null`, `dedupe_key text null unique`, `created_at`, `sent_at`. Claim with `UPDATE ... WHERE id IN (SELECT id ... FOR UPDATE SKIP LOCKED)`.

### 4.4 Storage
`storage.upload({ category, filename, declaredType, body, uploadedBy })` returns `{ key, size, contentType, sha256, originalName }`.
1. **Policy per category** (`receipts`, `employeeDocuments`, `profilePhotos` are provided): max bytes, allowed types. Empty and oversize files are rejected.
2. **Type check by content:** the declared MIME type and file extension must agree with the file's magic bytes (PDF `%PDF-`, PNG, JPEG). A program renamed to `.pdf` is rejected.
3. **Server-generated key** `category/yyyy/mm/<uuid>`: a client-supplied name is never part of the storage path (no traversal). The original filename is cleaned (no path, no control characters, max 120 chars) and kept as metadata only.
4. **Virus-scan hook** `scanner.scan(buffer, meta)`: infected or scanner error means rejected and nothing stored (fail closed). With `STORAGE_REQUIRE_SCAN=true` (required in production) the app will not start without a scanner.
5. **Download:** the module authorizes the user, then `storage.createDownloadLink(key, { subject, ttlSeconds })`. Link = `base64url(payload).base64url(HMAC-SHA256)`; payload has key, expiry and optional subject; TTL default 300 s, **maximum 900 s**; compared in constant time. `GET /api/v1/files/download?token=...` answers invalid or tampered tokens with 404 (no oracle), expired with 410, and streams the file with `Content-Disposition: attachment`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`, and the sniffed type, never the client's.
6. Adapters implement `put / get / delete / exists` on opaque keys. `LocalDiskStorageAdapter` rejects any key that is not `[a-z0-9_-]` path segments and re-checks the resolved path stays inside the storage root.

## 5. Configuration (all in `.env.example`)
| Variable | Default | Notes |
|---|---|---|
| `EMAIL_DRIVER` | `smtp` | `smtp` (Mailpit locally), `sendgrid`, `fake` |
| `SENDGRID_API_KEY` | empty | required when driver is `sendgrid`; never logged |
| `OUTBOX_POLL_INTERVAL_MS` / `OUTBOX_MAX_ATTEMPTS` | 10000 / 5 | |
| `STORAGE_DRIVER` | `local` | `local` or `memory`. `s3`/Cantobo is rejected with a clear message until D-10 is answered |
| `STORAGE_LOCAL_PATH`, `STORAGE_MAX_FILE_SIZE_MB` | `./uploads`, 10 | `uploads/` is added to `.gitignore` |
| `STORAGE_SIGNING_SECRET` | none | min 32 chars; **required in production**; in development a random per-process secret is used (links stop working after a restart) |
| `STORAGE_LINK_TTL_SECONDS` | 300 | capped at 900 |
| `STORAGE_REQUIRE_SCAN` | `false` | `true` in production |

## 6. Threats this design answers
Email header injection; spam through unlimited recipients; secrets and personal data in logs; losing audit records silently; sending mail for rolled-back actions; double sending by two workers; path traversal through file names; executable disguised as PDF; unscanned uploads; forged, tampered, expired or replayed download links; inline rendering of uploaded HTML/SVG (XSS); guessing which file keys exist; unbounded link lifetime; production running on non-durable fakes.

## 7. Test plan (Vitest, all automated)
| ID | Case |
|---|---|
| TC-13-01..07 | **Audit:** entry has id/time/actor/action/entity/outcome; invalid action or missing entity rejected; metadata redacted (names and text) and capped; `record` throws on store failure while `tryRecord` does not; interface has no update/delete; request context is applied; logger store writes one flagged JSON line |
| TC-13-08..10 | **Events:** subscribers called; one failing subscriber is isolated and logged; collector flushes in order only after commit and emits nothing after discard; unsubscribe works |
| TC-13-11..12 | **Outbox:** enqueue creates `pending`; same `dedupeKey` returns the same item; validation (bad address, CR/LF injection, 51 recipients, oversize body, empty subject) |
| TC-13-13..16 | **Dispatcher:** sends only due items; failure schedules backoff 30/60/120 s capped; dead after max attempts; two dispatchers never send the same item; an expired lock is reclaimed; logs never contain recipient, subject or body |
| TC-13-17..19 | **Email adapters:** SMTP builds the right message and refuses header injection; SendGrid sends the right request, maps failures without leaking the key, times out; all adapters pass the same contract suite |
| TC-13-20..24 | **Storage upload:** stored under a server key with size, sha256, sniffed type; rejects oversize, empty, wrong declared type, extension mismatch, disguised executable, disallowed type; filename sanitising (traversal, control chars, long); scan hook (infected, error, missing in production) |
| TC-13-25..28 | **Signed links:** valid works; expired, tampered payload, tampered signature, wrong secret, garbage, subject mismatch all rejected; TTL cap enforced |
| TC-13-29..31 | **Download route:** correct headers; 404 for invalid; 410 expired; deleting the file revokes access; nothing but the file body is returned |
| TC-13-32..33 | **Adapters:** local disk and memory pass the same storage contract; local disk rejects traversal and absolute keys and never leaves its root |
| TC-13-34..35 | **Platform wiring:** production refuses in-memory stores, missing signing secret, missing scanner when required, unsupported drivers; development works |
| TC-13-36 | **End to end:** upload, audit entry, event, notification enqueued and dispatched, download link works, using only fakes |

## 8. D-10: Cantobo storage (documented, answer needed from the infrastructure owner)
Nothing in the report describes the Cantobo API. The storage interface is deliberately small (`put`, `get`, `delete`, `exists` on opaque keys), so any backend that offers these can be added later as one adapter that must pass `contracts/storage.contract.ts`. Questions to answer before that adapter is written:
1. Is Cantobo storage S3-compatible (then one adapter with an S3 client covers it) or does it have its own API/SDK?
2. How are credentials issued and rotated, and is access private by default (no public buckets)?
3. Is encryption at rest handled by Cantobo ("encrypted private storage" in the report) or must the app encrypt?
4. Does Cantobo offer its own pre-signed URLs? We use application-issued links regardless, so this is optional.
5. Backups, retention and a maximum object size.
Until then development and CI use the local-disk and in-memory adapters, and production refuses to start with a driver that is not implemented.

## 9. Results
- **362 tests in 20 files, all passing** (`npm test`); 251 of them cover this issue. Contract suites run against the in-memory and local-disk storage adapters, the in-memory outbox and all three email adapters.
- **Real sockets, no mocks:** `nodemailer` was exercised against a local SMTP receiver and `fetch` against a local HTTP server (headers, recipients, timeouts, generic errors).
- **Mutation check:** 30 deliberate bugs were introduced one at a time (link signature, expiry, user binding, lifetime cap, MIME/extension spoofing, client file name in the key, scanner failing open or ignored, path traversal, inline display, missing `nosniff`, 403 instead of 404, unlocked outbox claims, endless retries, recipients in logs, header injection, recipient limit, dedupe, unredacted audit changes, swallowed audit failures, failing event handlers, events re-emitted, production without durable stores, `s3` accepted, SendGrid body in errors, unvalidated SMTP, world-readable files). Every one made a test fail.
- **Compiled server:** starts in development; refuses to start in production without durable stores; refuses `STORAGE_DRIVER=s3` with the D-10 explanation.
- **Found while testing:** a test showed the logger only hid secrets by field name; text such as `password=...` inside messages is now scrubbed (PR #59), and the audit logger gained the `transaction` option so audit and data commit together.

## 10. Merge note for developers
Dev 1: the SQL stores for audit and outbox belong with issue #6 (migration) using the contracts above; do not change the interfaces without asking. Dev 2: notifications for leave and attendance (#41) build on `NotificationService` and `EventBus`; do not call SMTP or SendGrid directly.
