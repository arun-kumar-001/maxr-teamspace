# D-25: Data Protection, Classification, and Retention Policy

- **Status:** Approved
- **Date:** 2026-11-04
- **Author:** Technical Lead
- **Deciders:** Technical Lead, Security Lead
- **Related Requirements:** AGENTS.md §1, §7; docs/security/threat-model.md; docs/security/asvs-checklist.md; Issue #16 (TL-14)

---

## 1. Context and Problem Statement

MAXR Teamspace processes workforce data ranging from public directory information to highly sensitive personal data, identity documents, bank accounts, and compensation. A formalized data classification and retention architecture is required to ensure compliance with data protection principles (confidentiality, integrity, availability, storage limitation, and purpose limitation), prevent unauthorized access (IDOR/mass assignment), and establish deterministic lifecycle policies for all stored entities.

---

## 2. Decision: Data Classification Matrix

All application data is classified into five distinct security classes:

| Class       | Classification            | Examples                                                               | Access Rule                                                            | Storage & Handling                                                                                                      |
| ----------- | ------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Class S** | **Sensitive**             | Government ID documents, bank accounts, compensation, payslips         | Explicit permission required (not role alone); access audited          | Excluded from default API responses and logs; encrypted at rest; served only via short-lived (≤ 300s) HMAC signed links |
| **Class P** | **Personal Data**         | Full name, phone, email, address, DOB, emergency contact               | Role + record scope enforced in queries                                | Redacted in request logs; field-level projection per caller role; self-service updateable via `/employees/me`           |
| **Class O** | **Operational Data**      | Attendance punches, leave requests, task assignments, expenses         | Role + record scope (Team Lead bounded to team; Staff bounded to self) | Parameterized queries; atomic state transitions; optimistic/pessimistic locking for balance integrity                   |
| **Class A** | **Audit Records**         | `audit_logs` (authentication, approvals, role changes, deactivations)  | Read-only for Admin; no update/delete endpoint                         | Append-only table; immutable audit trail; tamper-evident log design                                                     |
| **Class T** | **Technical & Ephemeral** | Redis session tokens, idempotency records, outbox queues, request logs | System / infrastructure only                                           | Strict TTL enforcement; auto-expiring keys; automated outbox purge                                                      |

---

## 3. Decision: Data Retention and Disposal Schedules

In accordance with storage limitation and employment record requirements:

| Data Category                    | Retention Schedule                     | Disposal / Purge Mechanism                                             | Justification                                                      |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------ |
| **Employee Master Record**       | Active employment + 6 years after exit | Soft-deactivated (`status = 'deactivated'`); never hard deleted        | Required for statutory employment disputes and tax compliance      |
| **Identity & Bank Documents**    | 1 year post-employee exit              | Hard deletion from storage adapter and metadata table                  | Minimizes exposure of Class S documents after termination          |
| **Attendance & Leave Summaries** | 6 years from creation                  | Partitioned archiving or retained in operational table                 | Statutory compliance for payroll and working hours audits          |
| **Expense Claims & Receipts**    | 6 years from claim settlement          | Receipts purged from storage after 6 years; financial ledger retained  | Tax audit and financial dispute limitation periods                 |
| **Tasks & Projects**             | 2 years after completion               | Soft-archive / purge completed project tasks                           | Low operational sensitivity once delivered                         |
| **Audit Logs (`audit_logs`)**    | 7 years                                | Retained append-only; immutable                                        | Forensic traceability, regulatory security audit trails            |
| **Session Store (Redis)**        | 2 hours idle / 24 hours absolute       | Automatic Redis TTL expiration; immediate purge on logout/deactivation | Prevents session fixation and stale session reuse                  |
| **Idempotency Keys**             | 24 hours                               | Expired by TTL store                                                   | Prevents duplicate replays while preventing unbounded store growth |
| **Outbox Queue (Processed)**     | 90 days after delivery                 | Automated background purge job                                         | Prevents notification table bloating                               |

---

## 4. Architectural Rules for Engineers

1. **Deny by Default & Scope in Repositories**:
   Server-side enforcement of role and record scope on every database query. Never fetch all records and filter in memory.
2. **Existence Leak Prevention**:
   Requests attempting to access records outside the caller's authoritative record scope must return `404 Not Found`, never `403 Forbidden` (conforming to `expectNoExistenceLeak`).
3. **Log Sanitization**:
   Passwords, tokens, session cookies, and Class S payloads must never be written to application logs. The logger must maintain active key- and pattern-based redaction.
4. **File Storage Isolation**:
   No direct object storage URL is ever exposed to client browsers. Files must only be retrieved via signed, user-bound, short-lived tokens created after explicit authorization checks.
5. **Fail-Closed Malware Scanning**:
   All file uploads must pass virus and malware screening (ClamAV adapter). If the scanner daemon is unreachable or errors out, the upload must fail closed with HTTP 503 (`SERVICE_UNAVAILABLE`).
6. **Data Subject Rights (Access, Correction, Erasure)**:
   - Access and correction are provided natively via `/employees/me` for editable contact fields.
   - Erasure requests for exited employees anonymize Class P personal attributes while preserving Class A audit logs and Class O operational references.

---

## 5. Consequences

### Positive

- Strict alignment with OWASP ASVS Level 2 standards (V4, V5, V6, V7, V8, V12).
- Clear, predictable retention rules preventing unbounded database and file storage growth.
- Protection against IDOR, privilege escalation, and credential exposure.

### Neutral / Trade-offs

- Soft-deactivation requires queries to continuously filter active/deactivated statuses.
- Automated purge jobs for technical and outbox tables must be monitored in production operations.
