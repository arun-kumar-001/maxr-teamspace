# Meetings: schedule, invitees, RSVP, minutes and reminders (#45, D-18)

## API (`/api/v1/meetings`)

| Route | Permission | Who |
| --- | --- | --- |
| `GET /meetings?from=&to=` | `meetings.read_own` | Meetings you organise or are invited to that overlap the window (instants; at most 62 days). |
| `POST /meetings` | `meetings.schedule` (Team Lead, HR Manager, Admin) | Schedules a meeting; you are the organizer. Up to 100 invitees. |
| `GET /meetings/{id}` | `meetings.read_own` | The organizer and the invitees only. Anyone else gets a 404, identical to a missing meeting. |
| `PUT /meetings/{id}` | `meetings.schedule` | The organizer only (403 for another invitee), with the `version` read (409 if stale). Changing invitees invites the new ones; a cancelled meeting cannot change. |
| `POST /meetings/{id}/cancel` | `meetings.schedule` | The organizer only, once. The invitees are told. |
| `POST /meetings/{id}/rsvp` | `meetings.rsvp` | An invitee answers `accepted`, `declined` or `tentative`. The organizer and anyone not invited get a 404. A cancelled meeting takes no answers. |

Staff hold `meetings.read_own` and `meetings.rsvp` but not `meetings.schedule`: they are invited, they do not schedule.

## Rules (D-18)

- **Times** are stored in UTC and shown in the company timezone. A meeting ends after it starts, lasts at most 24 hours, and must start in the future when it is scheduled (422).
- **Invitees** are active employees, unique, at most 100 (400 above the schema limit, 422 for an inactive or unknown one). The organizer is never an invitee.
- **Overlaps are warnings.** A new meeting that overlaps another scheduled meeting of the organizer or of any invitee is still created; the response lists the overlaps (`overlaps: [{ employeeId, meetingId }]`).
- **Visibility:** only the organizer and the invitees see a meeting. Everything about it, including the minutes, is in the SQL that reads it.
- **Agenda** (5,000 characters) and **minutes** (20,000 characters, plain text) are editable by the organizer. The audit trail records that they changed, never what they say.
- **Reminders:** 15 minutes before a meeting, to the invitees who have not declined, once per meeting. The job `meeting-reminders` (on the shared job runner) claims each meeting in a transaction, so a second run or a second instance sends nothing.
- **Notifications** (D-15, D-32): invitations, cancellations and reminders go through the notification module, deduplicated per meeting and kind. The text names no title and no agenda.

## Data

`meetings` and `meeting_attendees` (migration `20261030000032`): CHECKs on the time order, the 24-hour maximum, the minutes length, the status and the RSVP values; indexes for the reminder query, the organizer's list and the invitee's list. RBAC keys `meetings.schedule`, `meetings.read_own` and `meetings.rsvp` in `20261030000033`.

## Not built yet

- The calendar screens (agenda list on phone, week and month on desktop) and the schedule form. The backend answers the calendar query by window.
- Calendar sync with Google or Outlook (#46), which is optional and waits for your approval.
