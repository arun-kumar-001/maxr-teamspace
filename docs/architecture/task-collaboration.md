# Task comments and attachments (#44, D-14, D-35)

Whoever can see a task (its assignee, its assigner, the assignee's manager and any Admin; see [tasks.md](tasks.md)) can read its thread and files and add to them. Anyone else gets a 404 on every route below, identical to a missing task.

## API (`/api/v1/tasks/{id}/...`)

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /comments` | `tasks.read_own` | The thread, oldest first. `page`, `pageSize` (default 50). |
| `POST /comments` | `tasks.collaborate` | `{ body }` (1 to 2000 characters). Comments cannot be edited or deleted. |
| `GET /attachments` | `tasks.read_own` | File metadata: name, type, size, who attached it. Never the storage key or hash. |
| `POST /attachments` | `tasks.collaborate` | The file is the **raw request body**: `Content-Type` of the file and `X-Filename` (percent-encoded). 201 with the metadata. |
| `GET /attachments/{attachmentId}/download-link` | `tasks.read_own` | `{ url, expiresAt }`: a short-lived link bound to your session, opened at `GET /files/download`. |
| `DELETE /attachments/{attachmentId}` | `tasks.collaborate` | The person who attached it, the person who assigned the task, or an Admin. |

## Uploads

- No multipart library is used: `http/raw-upload.ts` reads the body as bytes (a JSON body is refused) with a 10 MB read limit (413), and the filename comes from the `X-Filename` header so it never appears in a URL or an access log. The same helper serves the later receipt and employee-document uploads.
- The storage service decides: PDF, PNG or JPEG **by content** (the declared type and the file extension must agree, otherwise 400), at most 10 MB (413), and the virus-scan hook (422 if rejected, 503 if the scanner is down). New category `taskAttachments` (storage keys `task-attachments/YYYY/MM/<uuid>`).
- A task holds at most **20** files (422). The count and the insert run under a per-task advisory lock, so 25 uploads at once leave exactly 20.
- The same file (SHA-256) is attached to a task **once** (409), which also makes a retried upload harmless. The idempotency-key middleware is not used because it fingerprints the body as JSON.
- If recording the file fails after it was stored, the stored object is removed again. Removing a file deletes the row first and the object after the commit; a storage failure then leaves an unreachable object that is logged, never a record pointing at nothing.

## Notifications and audit

A comment emits `tasks.commented`; the assignee and the assigner are told ("New comment on a task"), except the author, and the text is never sent. The audit trail records `task.comment`, `task.attachment_add` and `task.attachment_remove` with ids, type and size only: comment text and file names can name people or clients and stay out.

## Data

`task_comments` and `task_attachments` (migration `20261030000030`); `UNIQUE (task_id, sha256)` and `UNIQUE (storage_key)`. RBAC key `tasks.collaborate` (everyone, own) in `20261030000031`.
