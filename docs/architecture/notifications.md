# Notifications: inbox, e-mail, reminders and announcements (#41, D-15, D-32)

## API (`/api/v1/notifications`)

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /notifications` | `notifications.read_own` | Your own, newest first. `unread=true`, `page`, `pageSize`. `meta.unread` is the bell badge. |
| `POST /notifications/{id}/read` | `notifications.read_own` | Marks one of yours read; repeating keeps the first time. Anyone else's id is a 404, identical to a missing one. |
| `POST /notifications/read-all` | `notifications.read_own` | Marks all of yours read. |
| `POST /notifications/announcements` | `notifications.announce` (Admin) | `Idempotency-Key` required. `{ title (100), message (1000) }`. One in-app notification for every active employee; **not e-mailed**. |

No route takes a recipient: every query is filtered by the signed-in employee in SQL.

## What creates a notification

The module subscribes to domain events, which the platform delivers **after the transaction that caused them has committed**, so nothing is sent for work that was rolled back. A failing subscriber is logged and never reaches the code that raised the event.

| Event | Who is told | Type |
| --- | --- | --- |
| `approvals.requested` | the approvers of the first step: the requester's manager, or the active HR Managers and Admins (never the requester) | `approval.requested` |
| `approvals.advanced` | the approvers of the next step | `approval.advanced` |
| `approvals.approved` / `approvals.rejected` | the requester | `approval.approved` / `approval.rejected` |
| `leave.cancelled` with `byOwner: false` | the owner of the leave | `leave.cancelled` |
| the reminder job | the approvers of a step that has waited over 24 hours | `approval.reminder` |

Because leave requests, attendance corrections and later expense claims all go through the approvals engine, they are covered by the same four events. The title names the kind ("Leave request waiting for your decision"). Task-due and meeting reminders (D-15) join when those modules exist: they only need an event or a job and a template.

Each notification carries a dedupe key per recipient (for example `approval.reminder:{approvalId}:{stage}`). The same event twice, or a reminder run twice, creates one row and one e-mail.

## E-mail

Sent through the outbox (`platform.notifications.enqueueEmail`): queued after the commit, retried with backoff by the dispatcher, failures stay visible in the outbox. The text is the title plus a pointer to the app. **It never carries a reason, dates, days, amounts, names or comments** (D-15); those are read after signing in. `APP_URL` (optional) adds the link; without it the e-mail says "Open MAXR Teamspace to see it." Texts live in `templates.ts` with `TEMPLATE_VERSION`. If the e-mail cannot be queued, the in-app notification stands and the failure is logged.

## Background jobs

`platform/jobs/job-runner.ts` runs jobs on an interval inside the API process (`JOBS_ENABLED`, default true; `JOBS_INTERVAL_MS`, default 15 minutes). With several API instances every one ticks, but a PostgreSQL **transaction-level advisory lock** (key = job name) lets only one run a given job at a time; the others skip that tick. The lock goes with the transaction, so a crashed instance cannot hold it. A failing job is logged and retried at the next tick.

Jobs today: `notification-reminders` (once per approval step) and `notification-retention` (deletes notifications read more than 90 days ago; unread ones stay).

## Data

`notifications` (migration `20261030000025`): recipient, type, title, body, a `link` that must be a path inside the app (a `//host` link is refused), `dedupe_key`, `read_at`. RBAC keys in `20261030000026`.
