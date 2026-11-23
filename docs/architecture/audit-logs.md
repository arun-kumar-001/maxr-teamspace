# Audit log viewer

Issue #28 (backend half). The audit trail is written by the platform audit logger (`docs/architecture/shared-services.md` §4.1) into the append-only `audit_logs` table; this module only reads it.

## API

`GET /api/v1/audit-logs`, permission `audit_logs.list` (Admin only). **There is no route that writes, and the table refuses UPDATE, DELETE and TRUNCATE in the database**; any other method on the path is a plain 404.

| Query                    | Meaning                                                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `page`, `pageSize`       | Paging (default 50, maximum 100)                                                                                         |
| `actorId`                | The user who acted (UUID)                                                                                                |
| `action`                 | Exact `module.verb`, for example `leave.approve`                                                                         |
| `module`                 | Every action of one module, for example `leave` (not together with `action`)                                             |
| `entityType`, `entityId` | The record the entry is about                                                                                            |
| `outcome`                | `success`, `denied` or `failure`                                                                                         |
| `from`, `to`             | ISO date-times with offset; `from` inclusive, `to` exclusive, `from` must be earlier                                     |
| `sortOrder`              | `desc` (default, newest first) or `asc`; entries at the same instant are ordered by id, so paging never repeats or skips |

Unknown query keys are rejected. Each entry has `id`, `occurredAt`, `action`, `outcome`, `actor` (`id`, the employee `name` while the account exists, `role`), `entityType`, `entityId`, `requestId`, `changes`, `metadata`.

## Sensitive data

Entries are redacted when they are written. They are **redacted again on the way out** (same rules as the logs: passwords, tokens, bank and similar keys), so a value that got in through an old row or a direct insert still never reaches a screen. Modules must still keep personal data out of `changes` and `metadata`.

## Data

Existing indexes serve actor, entity and time filters. Migration `20261030000010` adds `(action text_pattern_ops, occurred_at DESC)` for the action and module filters. Reading the audit trail is not itself audited.
