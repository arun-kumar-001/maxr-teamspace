# Projects and membership (#42, D-14, D-33)

Projects group tasks (#43). A project has one owner and a set of members.

## API (`/api/v1/projects`)

| Route | Permission | Notes |
| --- | --- | --- |
| `GET /projects` | `projects.read` | The projects you own or belong to; an Admin sees all. `status`, `q` (name or code), `page`, `pageSize`. |
| `POST /projects` | `projects.manage` (Team Lead, Admin) | `Idempotency-Key` required. `{ code, name, description?, startDate?, endDate?, ownerEmployeeId?, memberIds? }`. A Team Lead owns what they create; only an Admin may name another owner. 409 for a repeated code (any letter case). |
| `GET /projects/{id}` | `projects.read` | With members. A project you neither own nor belong to is a 404, identical to a missing one. |
| `PUT /projects/{id}` | `projects.manage` | Send the `version` you read (409 if it changed). `status: archived` archives, `active` reactivates. Nothing different writes nothing. |
| `POST /projects/{id}/members` | `projects.manage` | `{ employeeId }`. Adding someone already in is harmless. |
| `DELETE /projects/{id}/members/{employeeId}` | `projects.manage` | The owner cannot be removed (422). |

## Rules (D-33)

- **Who may change a project:** its owner or an Admin. A Team Lead who is only a member can read it, not change it (403). Someone who cannot see it gets a 404 on every route.
- **Owner:** an active employee holding the Team Lead or Admin role. The owner is always a member.
- **Members:** active, and the owner or one of the owner's direct reports, checked when they are added. A member who later moves to another team or is deactivated stays on the project until removed.
- **Archived** projects are read-only (members, edits) except reactivating them; they stay visible. Nothing is deleted.
- `GET /projects` visibility is computed in SQL (`owner = me OR member`), never after fetching.
- Other modules read a project through `ProjectReader.access(id)` (status, owner, member ids), not its tables.
- Audit: `project.create`, `project.update`, `project.archive`, `project.reactivate`, `project.member_add`, `project.member_remove`; ids and field changes only.

## Data

`projects` (migration `20261030000027`): unique upper-case `code`, `status`, optional dates in order, `version`. `project_members` (primary key `(project_id, employee_id)`, indexed by employee). RBAC keys `projects.read` (everyone; Admin all) and `projects.manage` (Team Lead, Admin) in `20261030000028`. The `own` scope of `projects.read` means "projects I own or belong to".
