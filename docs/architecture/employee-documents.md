# Employee Documents & Signed Links

Issue #25 ([D1-08] Employee documents with signed links, D-10, D-25). Manages the storage, upload, metadata tracking, and ephemeral signed download access for employee files (identification, education certificates, contracts, offer letters, tax documents).

## 1. Storage Architecture & Raw-Body Uploads

In conformance with **decision D-10** and the MAXR Teamspace storage service:
- Files are stored in private encrypted storage under prefix `employee-documents/YYYY/MM/<uuid>`.
- The storage key and SHA-256 hashes are strictly internal; they are never sent to clients.
- Uploads use `http/raw-upload.ts` with `rawUploadParser(10 * MB)` (10 MB limit). No multipart libraries are used.
- Metadata is conveyed via query parameters (`documentType`, `title`, `isSensitive`) or headers (`X-Filename`, `X-Document-Type`, `X-Document-Title`, `X-Is-Sensitive`).
- Content inspection (magic byte sniffing) enforces that only genuine PDF, PNG, or JPEG files are accepted.
- A unique partial index on `(employee_id, sha256)` prevents duplicate document uploads for the same employee (returns 409 Conflict).

---

## 2. Ephemeral User-Bound Signed Download Links

Direct file downloads are served at `GET /api/v1/files/download?token=...`.
- To access a file, clients first call `GET /api/v1/employees/:id/documents/:docId/download-link`.
- The endpoint performs authorization checks (Admin/HR Manager, or Staff viewing their own document).
- Storage service issues an HMAC-SHA256 signed token cryptographically bound to the caller's `actorId` with a 15-minute TTL (900 seconds).
- Expired links return `410 LINK_EXPIRED`. Tampered tokens or tokens presented by another user return `404 Not Found`.

---

## 3. Security, Scope & RBAC Rules

Per AGENTS.md §1 & §7:
- **Admin**: Full access across all employees.
- **HR Manager**: Full access across all employees in HR scope.
- **Staff**: Can list, upload, and download documents for their **own profile only**. Attempting to access another employee's documents returns `404 Not Found` (never leaks record existence). Staff cannot delete documents.
- **Team Lead**: **Denied by default**. Team Leads do not have permission to view, upload, or download employee personal and identity documents (returns `403` or `404`).

---

## 4. API Endpoints

| Method | Path | Permission | Description |
|---|---|---|---|
| `GET` | `/api/v1/employees/:id/documents` | `documents.read` | List active document metadata for an employee |
| `POST` | `/api/v1/employees/:id/documents` | `documents.upload` | Upload binary document with metadata |
| `GET` | `/api/v1/employees/:id/documents/:docId/download-link` | `documents.download` | Generate 15-minute user-bound signed download link |
| `DELETE` | `/api/v1/employees/:id/documents/:docId` | `documents.delete` | Soft delete document record |

