# API Conventions and Shared Backend Helpers (issue #9, TL-07)

**Status:** Plan → implementation on branch `tl/api-conventions`. Owner: Technical Lead. Rules come from `AGENTS.md` §5 (API conventions) and §7 (security); this document defines how they are implemented once, so no module re-implements them.

## 1. What already exists (do not redo)
Error envelope + `AppError`, request id middleware, 404 handler, `PaginatedResponse` types, `ERROR_CODES`, env validation (all from PR #53). The health endpoint ships in PR #56 (issue #4). Missing and delivered here: validation, pagination helper, idempotency/409 helpers, structured logging with PII redaction, rate limiting, OpenAPI, and a sample module that uses all of them.

## 2. Decisions
| Topic | Decision | Reason |
|---|---|---|
| Validation | **Zod 3** schemas; primitives live in `packages/shared` so the web app can reuse them | `AGENTS.md` §2 proposal; one schema gives validation, TypeScript types and OpenAPI |
| Logging | Small in-house JSON logger behind a `Logger` interface, with a redaction utility. No new dependency | Redaction rules are ours; swapping to `pino` later changes one file |
| Rate limiting | `express-rate-limit` v7 (in-memory store now; Redis store when Redis client lands in #56/#7) | Standard, maintained; avoids writing security code |
| OpenAPI | `@asteasolutions/zod-to-openapi` generates OpenAPI 3.0 from the same Zod schemas | Spec cannot drift from validation |
| Idempotency | `Idempotency-Key` header middleware with a pluggable store (in-memory now, Redis later) | Required for check-in and approvals (`AGENTS.md` §5) |

## 3. Layout
```
packages/shared/src/http/        zod primitives: idParam, paginationQuery, sort helpers; error codes
apps/api/src/http/               asyncHandler, validate, pagination, idempotency, rate-limit, db-errors, http-config
apps/api/src/logging/            logger, redact, request-logger
apps/api/src/openapi/            registry, build-spec, generate script
apps/api/src/routes/index.ts     the single /api/v1 router (modules are mounted here)
apps/api/src/modules/_template/  sample module using every convention
```
`app.ts` changes are kept small (wiring only) to avoid conflicts with the open PRs #56 and the #52 follow-up.

## 4. Request lifecycle
```
request → trust proxy → request id → request logger → CORS → JSON body (1 MB)
        → global rate limit → /api/v1 router → [authenticate → authorize]*(#7/#8)
        → validate(params, query, body) → [idempotency] → controller → service → repository
        → notFound → errorHandler (single place that maps every error to the envelope)
```
`*` arrives with issues #7 and #8; the sample module marks where they plug in.

## 5. Contracts
**Errors** (extends the existing envelope; never leaks stack traces or internals):

| Situation | HTTP | `code` |
|---|---|---|
| Schema validation fails (body, query, params) | 400 | `VALIDATION_ERROR` with `details[{field,message,rule}]` |
| Malformed JSON | 400 | `BAD_REQUEST` |
| Not logged in / forbidden | 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` (out-of-scope records answer **404**) |
| Not found | 404 | `NOT_FOUND` |
| Duplicate (unique violation, same idempotency key in flight) | 409 | `CONFLICT` |
| Business rule violated (e.g. illegal state transition) | 422 | `UNPROCESSABLE_ENTITY` |
| Body too large | 413 | `PAYLOAD_TOO_LARGE` |
| Rate limit | 429 | `RATE_LIMITED` + `Retry-After` |
| Anything else | 500 | `INTERNAL_SERVER_ERROR` (generic message; details only in logs) |

**Pagination:** query `page` (default 1), `pageSize` (default 20, **max 100**), `sortBy` (must be in the module's allow-list), `sortOrder` (`asc|desc`). Response `{ data, meta: { page, pageSize, total, totalPages } }`. Out-of-range values are rejected with 400, not silently clamped.

**Idempotency:** header `Idempotency-Key` (8–128 chars `[A-Za-z0-9_-]`). Scope = method + route + key. Same key and same body → the stored response is replayed with header `Idempotent-Replayed: true`. Same key and a different body → 422. Same key while the first request is still running → 409. Entries expire after 24 h. Required on endpoints that opt in (check-in, approvals, create employee).

**Database errors:** Postgres `23505` (unique) → 409, `23503` (foreign key) → 422, `23514`/`23502` → 422. Mapped in one helper so repositories do not leak SQL messages.

**Logging:** one JSON line per event: `time, level, msg, requestId, method, path, status, durationMs`. The query string is never logged; request bodies are never logged. Redaction (case-insensitive key match, deep): `password, passwordHash, token, accessToken, refreshToken, authorization, cookie, set-cookie, secret, apiKey, ssn, nationalId, bankAccount, iban, salary, compensation`. Redacted values appear as `[REDACTED]`. Level from `LOG_LEVEL`.

**Rate limits** (env-configurable): global 300 requests/minute/IP; `strictLimiter` (10/15 min) exported for `POST /auth/login` (wired in #7). `TRUST_PROXY` = number of proxy hops (0 locally, 1 behind Nginx); a wrong value allows IP spoofing, so it is documented in `.env.example`.

**OpenAPI:** modules register routes with Zod schemas in a shared registry; `GET /api/v1/openapi.json` serves the spec when `NODE_ENV !== production`; `npm run openapi:generate` writes `docs/architecture/openapi.json`, and a test fails if the committed file is out of date.

## 6. Test plan (all automated, Vitest + Supertest in `apps/api`)
| ID | Case | Expected |
|---|---|---|
| TC-9-01 | Body fails schema | 400 `VALIDATION_ERROR`, `details` has field names, no stack trace |
| TC-9-02 | Invalid UUID in `:id` | 400 |
| TC-9-03 | Unknown query keys / bad types | 400 (strict) |
| TC-9-04 | Malformed JSON; body over 1 MB | 400 `BAD_REQUEST`; 413 `PAYLOAD_TOO_LARGE` |
| TC-9-05 | `async` controller throws | handled, envelope returned, server stays up |
| TC-9-06 | Unexpected error | 500 generic message; internal text not in response; logged with requestId |
| TC-9-07 | Pagination defaults, max 100, page 0, pageSize 101, bad sortBy | defaults applied; 400 for invalid |
| TC-9-08 | Pagination math (total, totalPages, offset/limit) | correct, including empty and last page |
| TC-9-09 | Idempotency: same key+body twice | second is replay, handler ran once |
| TC-9-10 | Idempotency: same key, different body | 422 |
| TC-9-11 | Idempotency: concurrent same key | one 2xx, other 409 |
| TC-9-12 | Idempotency: missing/invalid key on required endpoint | 400 |
| TC-9-13 | DB error mapping 23505 / 23503 / unknown | 409 / 422 / 500 |
| TC-9-14 | Logger redacts nested sensitive keys and arrays | `[REDACTED]`; non-sensitive kept |
| TC-9-15 | Request log has no query string and no body | verified |
| TC-9-16 | Rate limit exceeded | 429 envelope + `Retry-After`; counter per IP |
| TC-9-17 | Request id echoed in header, body and log | same id |
| TC-9-18 | OpenAPI: valid 3.0 doc, lists sample module, committed file in sync | pass |
| TC-9-19 | Sample module end-to-end (create, list, get, update, deactivate) | all conventions respected |
| TC-9-20 | Unknown route | 404 envelope |

## 7. Out of scope here
Authentication and authorization middleware (#7, #8), Redis-backed stores (after #56/#7), the health endpoint (#56), and the Express hardening items in #52 (`x-powered-by`, request-id format). Merge note for Dev 1: after this lands, run `git merge origin/develop`; conflicts are limited to `package.json`/`package-lock.json` (regenerate with `npm install`) and `app.ts` wiring.
