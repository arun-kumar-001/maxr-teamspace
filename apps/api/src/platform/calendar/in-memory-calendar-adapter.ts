import { randomUUID } from 'node:crypto';
import type {
  CalendarEventPayload,
  CalendarEventReference,
  ICalendarAdapter,
} from '../contracts/calendar-adapter.contract';

export class InMemoryCalendarAdapter implements ICalendarAdapter {
  private readonly events = new Map<string, CalendarEventPayload>();

  async createEvent(payload: CalendarEventPayload): Promise<CalendarEventReference> {
    const externalEventId = `cal-evt-${randomUUID()}`;
    this.events.set(externalEventId, { ...payload });

    return {
      provider: 'in_memory',
      externalEventId,
      htmlLink: `https://calendar.example.internal/events/${externalEventId}`,
      syncedAt: new Date(),
    };
  }

  async updateEvent(
    externalEventId: string,
    payload: Partial<CalendarEventPayload>,
  ): Promise<CalendarEventReference> {
    const existing = this.events.get(externalEventId);
    if (!existing) {
      throw new Error(`Calendar event with id ${externalEventId} not found`);
    }

    const updated: CalendarEventPayload = {
      ...existing,
      ...payload,
      organizer: payload.organizer ?? existing.organizer,
      attendees: payload.attendees ?? existing.attendees,
    };

    this.events.set(externalEventId, updated);

    return {
      provider: 'in_memory',
      externalEventId,
      htmlLink: `https://calendar.example.internal/events/${externalEventId}`,
      syncedAt: new Date(),
    };
  }

  async deleteEvent(externalEventId: string): Promise<void> {
    this.events.delete(externalEventId);
  }

  async getEvent(externalEventId: string): Promise<CalendarEventPayload | null> {
    const event = this.events.get(externalEventId);
    return event ? { ...event } : null;
  }

  /** Clears all stored events in memory (helper for test cleanup). */
  clear(): void {
    this.events.clear();
  }
}
