# Tasks: assignment, lifecycle and boards (#43, D-14, D-34)

## API (`/api/v1/tasks`)

| Route | Permission | Notes |
| --- | --- | --- |
| `POST /tasks` | `tasks.create` (Team Lead, Admin) | `Idempotency-Key` required. `{ title, assigneeEmployeeId, description?, priority? (default medium), dueDate?, projectId? }`. The assigner is the signed-in caller. Starts `todo`. |
| `GET /tasks/me` | `tasks.read_own` | Tasks assigned to you: open work first, soonest due first (undated last), then by priority. Filters `status`, `priority`, `projectId`, `dueFrom`, `dueTo`, `overdue=true`; paged. |
| `GET /tasks` | `tasks.read_team` (Team Lead, Admin) | The team board: tasks you assigned and tasks assigned to your direct reports. An Admin sees every task. Same filters plus `assigneeEmployeeId`. |
| `GET /tasks/{id}` | `tasks.read_own` | Visible to the assignee, the assigner, the assignee's manager and any Admin. Anyone else gets a 404, identical to a missing id. |
| `PUT /tasks/{id}` | `tasks.create` | The assigner or an Admin edits a task that is not completed. Send the `version` you read (409 if stale). |
| `POST /tasks/{id}/status` | `tasks.update_status` | `{ status }`. See the table below. |

Every task carries `isOverdue` (past its due date on the company calendar and not completed), `assigneeName`, `assignerName` and `projectName`.

## Lifecycle (D-14)

| From | To |
| --- | --- |
| `todo` | `in_progress` |
| `in_progress` | `in_review`, `blocked`, `todo` |
| `in_review` | `completed`, `in_progress` |
| `blocked` | `in_progress` |
| `completed` | `in_progress` (reopen) |

- Any other move is a **422** that names the moves that are open.
- The assignee, the assigner and an Admin may move a task. **Only the assigner or an Admin completes or reopens it**; the assignee moves it as far as review. A person who is none of the three, such as the assignee's manager on a task an Admin assigned, can read the task but gets a 403 on a move.
- Repeating the status a task already has is a 200 that changes nothing and writes no audit entry.
- The task row is locked while a move is checked, so two moves at once are decided one after the other against the real status.
- `completed_at` is set when a task completes and cleared on reopening; a database CHECK keeps it in step with the status.

## Assignment (D-34)

- A **Team Lead** assigns to themselves or their active direct reports; an assignee outside the team is a **403**. An **Admin** assigns to any active employee. An assignee who is not active, or does not exist, is a 422.
- With a **project**: it must exist and be active, the assigner must own it, belong to it or be an Admin, and the assignee must be one of its members (422 otherwise). Tasks can exist without a project.
- A due date in the past is refused on creation and when it is changed (an existing one is left alone).
- Reassigning restarts the task as `todo` for the new person and notifies them. Only the assigner or an Admin reassigns, and the new assignee follows the same team rule.
- Nothing is deleted. Titles and descriptions stay out of the audit trail (they can name people or clients); it records ids and field changes.

## Notifications (D-32)

Events `tasks.assigned` and `tasks.status_changed` are announced after the commit. The assignee is told of a new task (not when assigned to themselves); the assigner when a task goes to review or is blocked; the assignee when it is completed or reopened. Nobody is told about a move they made themselves. The text never contains the task title. The "task due in 24 hours" reminder (D-15) is a separate job, not part of this change.

## Data

`tasks` (migration `20261030000029`): CHECKs on status, priority, a non-blank title and `completed_at` matching the status; indexes for the assignee's board, the assigner, the project, and open tasks by due date. No new permissions: the catalog already had `tasks.create`, `tasks.read_own`, `tasks.read_team` and `tasks.update_status`.
