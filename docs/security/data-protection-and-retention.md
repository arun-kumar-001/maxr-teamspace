# Data Protection and Retention (draft, decision D-25)

**Status:** Proposal for the business owner and TL. **Not legal advice.** The report states no legal basis or retention period, so every period below is a placeholder to confirm.

## 1. Data classes

| Class              | Examples                                           | Access rule                                        | Handling                                                                                            |
| ------------------ | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **S: Sensitive**   | ID documents, bank account, compensation, payslips | Explicit permission (not role alone); audited read | Excluded from default responses and logs; encrypted at rest; downloads via signed, user-bound links |
| **P: Personal**    | Name, contact, address, DOB, emergency contact     | Role + record scope                                | Redacted in logs; field-level visibility per role                                                   |
| **O: Operational** | Attendance, leave, tasks, meetings, expenses       | Role + record scope                                | Standard                                                                                            |
| **A: Audit**       | `audit_logs`                                       | Admin read only; no update/delete API              | Append-only                                                                                         |
| **T: Technical**   | Sessions, idempotency keys, outbox, request logs   | Operators                                          | Short TTL (below)                                                                                   |

## 2. Rules (from `AGENTS.md` §7)

1. Sensitive fields never appear in list responses, logs, emails or error messages.
2. Staff see only their own records; Team Lead only direct reports; cross-scope reads return 404.
3. Exports (CSV/PDF) are audited and scoped like the on-screen view.
4. No production data in dev/test; seeds use synthetic people only.
5. People are deactivated, not deleted; history is kept for the retention period.

## 3. Retention proposal (placeholders, to confirm)

| Data                               | Proposed retention                                    | Notes                                            |
| ---------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Employee master record             | Employment + [6] years after exit                     | Soft-deactivated; confirm local labour law       |
| Identity/bank documents            | Delete [1] year after exit unless law requires longer | Hard-delete the file in storage and its metadata |
| Attendance, leave, expense records | [6] years                                             | Needed for payroll and disputes                  |
| Tasks, meetings                    | [2] years after completion                            | Low sensitivity                                  |
| Audit logs                         | [7] years                                             | Integrity-critical; never edited                 |
| Sessions                           | Until expiry/revocation, then purge                   | Redis TTL                                        |
| Idempotency keys                   | 24 hours                                              | Already time-limited                             |
| Notification outbox (sent)         | 90 days                                               | Purge job needed                                 |
| Application logs                   | 30-90 days                                            | Redacted at write                                |
| Backups                            | [35] days rolling, encrypted                          | Restore drill before launch (#17)                |

## 4. Requests from employees

Access and correction: through `/employees/me` for allowed fields and HR for the rest. Erasure requests: HR + TL decide per law; default is anonymise operational rows and keep audit entries.

## 5. Decisions needed (TL / business owner)

1. Applicable law and legal basis (country of operation).
2. Final retention periods above.
3. Whether compensation and bank data are stored at all in this system (payroll is out of scope; D-16).
4. Who may hold the "sensitive fields" permission (HR only, or also Admin).
5. Encryption at rest: storage-level (Cantobo, D-10) and/or application-level for S-class columns.
