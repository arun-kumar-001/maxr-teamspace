# ADR D-18: Calendar Sync Strategy & Adapter Interface

- **Status:** Pending Approval
- **Deciders:** Technical Lead (`arun-kumar-001`), Developer (`maxrindia30-vb`)
- **Date:** 2026-11-03
- **Context:** Issue #46, [D2-14 in developer-work-breakdown.md](../../project-planning/developer-work-breakdown.md#d2-14--calendar-sync-optional---p3--l--d-18), [meetings module](../../../apps/api/src/modules/meetings/), [AGENTS.md §2 & §3](../../../AGENTS.md)

---

## Context and Problem Statement

MAXR Teamspace has a fully functional Meetings & Collaboration module (Issue #45 / PR #147), allowing employees to schedule meetings, invite attendees, record agenda items, and track RSVPs.

The product roadmap lists **Calendar Sync** as an optional integration (P3, [D2-14]). The goal is to synchronize scheduled company meetings to external calendars (Google Calendar and Microsoft 365 / Outlook) without introducing tight coupling, external latency into synchronous HTTP requests, or credential exposure.

Issue #46 explicitly states:

> _"Calendar sync adapter behind an interface, OAuth, one-way push first. Do not start until the Technical Lead approves (decision D-18). Calendar sync appears in the report roadmap but is optional in the HLD."_

## Decision Drivers

1. **Strict Decoupling (AGENTS.md §3):** Side effects (email, SMS, calendar) must go through an interface with an adapter so unit and integration tests use in-memory fakes with zero third-party dependencies.
2. **Non-blocking Execution:** Meeting scheduling (`POST /api/v1/meetings`), updates, and cancellations must remain snappy and responsive ($< 100\text{ms}$). External API latency or third-party outages must never fail or block the local meeting record creation.
3. **One-Way Push First:** MAXR Teamspace remains the authoritative source of truth for meetings. External calendar events are pushed from Teamspace outward; bidirectional sync is deferred to avoid complex distributed lock / conflict reconciliation in Phase 1.
4. **Credential Security (AGENTS.md §7):** OAuth2 refresh tokens and client credentials must be encrypted at rest (AES-256-GCM) and never leaked to logs or client applications. Scopes must be restricted to minimal calendar access (`calendar.events` / `Calendars.ReadWrite`).
5. **Zero External Runtime Bloat:** Avoid heavyweight SDKs (`googleapis`, `@microsoft/microsoft-graph-client`) where lightweight, standard `fetch` HTTP requests suffice.

---

## Options Considered

| Option                                                                  | Architecture                                                                                                                                                                                                                                                         | Verdict           | Trade-offs                                                                                                                                                     |
| :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Option A: Interface Adapter + Outbox / Event Listener (Recommended)** | `ICalendarAdapter` port in platform layer with `InMemoryCalendarAdapter` (tests) and provider adapters (`GoogleCalendarAdapter`, `OutlookCalendarAdapter`). Meetings service emits `meeting.scheduled` domain event; asynchronous worker processes sync out-of-band. | **Recommended**   | Fully decoupled; testable without mocks/network; resilient to provider downtime; clean one-way push.                                                           |
| **Option B: Synchronous Inline Calls in MeetingsService**               | MeetingsService directly calls Google/Microsoft API before committing the meeting transaction.                                                                                                                                                                       | **Rejected**      | Violates clean architecture; third-party latency blocks database transaction; network failure aborts meeting creation.                                         |
| **Option C: Client-Side Browser Sync (Web OAuth)**                      | Frontend React app initiates OAuth flow and pushes directly to Google/Outlook from the user's browser.                                                                                                                                                               | **Rejected**      | Requires every participant to have their browser open; cannot sync for invited teammates who are offline; leaks credentials to browser.                        |
| **Option D: iCalendar Feed (.ics subscription) Only**                   | Publish unique token-authenticated `.ics` subscription URLs per employee.                                                                                                                                                                                            | **Complementary** | Zero OAuth setup, works with Apple Calendar/Thunderbird/Outlook, but relies on polling interval (often 1–24 hours delay). Recommended as an optional fallback. |

---

## Proposed Decision Details

### 1. Domain Contract (`ICalendarAdapter`)

The platform layer defines the agnostic interface contract under `apps/api/src/platform/contracts/calendar-adapter.contract.ts`:

```typescript
export interface CalendarEventPayload {
  meetingId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  organizer: {
    email: string;
    name: string;
  };
  attendees: Array<{
    email: string;
    name: string;
    rsvpStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
}

export interface CalendarEventReference {
  provider: 'google' | 'outlook' | 'in_memory';
  externalEventId: string;
  htmlLink?: string;
}

export interface ICalendarAdapter {
  createEvent(payload: CalendarEventPayload): Promise<CalendarEventReference>;
  updateEvent(
    externalEventId: string,
    payload: Partial<CalendarEventPayload>,
  ): Promise<CalendarEventReference>;
  deleteEvent(externalEventId: string): Promise<void>;
}
```

### 2. Execution Flow (Out-of-Band Event Driven)

```
[Organizer Client]
       │
       ▼ POST /api/v1/meetings
[MeetingsService]
       │
       ├─► 1. Validate & Save to PostgreSQL (Authoritative DB Transaction)
       │
       └─► 2. Emit `meeting.scheduled` on Event Bus / Outbox
              │
              ▼ (Async Background Worker)
       [CalendarSyncJob]
              │
              ▼ Calls `ICalendarAdapter`
       ┌──────────────────────────────┐
       │ - In-Memory (Test/CI)        │
       │ - Google Calendar Adapter    │
       │ - Microsoft Outlook Adapter  │
       └──────────────────────────────┘
```

### 3. Testing Strategy

- `InMemoryCalendarAdapter` maintains an internal map of created calendar events in memory.
- Vitest unit tests in `apps/api` test all event creation, update, and cancellation lifecycles without network calls or secrets.
- Integration tests in CI run purely against the `InMemoryCalendarAdapter`.

---

## Consequences

### Positive

- Fully complies with AGENTS.md §2, §3, and §7.
- Complete isolation: Meetings module does not know whether Google Calendar, Outlook, or In-Memory fake is running.
- Zero risk of third-party outages disrupting core employee meeting operations.
- Clean foundation ready for OAuth credential binding when provider credentials are provided.

### Negative / Mitigations

- Requires background worker queue processing (already built via platform event bus and job runner).
- One-way push does not reflect if an employee accepts an invite in their Google Calendar back to MAXR Teamspace until two-way webhooks are implemented in a future milestone.
