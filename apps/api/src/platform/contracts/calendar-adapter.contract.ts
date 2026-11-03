import { describe, expect, it } from 'vitest';

export interface CalendarAttendee {
  email: string;
  name: string;
  rsvpStatus?: 'accepted' | 'declined' | 'tentative' | 'needsAction';
}

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
  attendees: CalendarAttendee[];
}

export interface CalendarEventReference {
  provider: 'google' | 'outlook' | 'in_memory';
  externalEventId: string;
  htmlLink?: string;
  syncedAt: Date;
}

export interface ICalendarAdapter {
  createEvent(payload: CalendarEventPayload): Promise<CalendarEventReference>;
  updateEvent(
    externalEventId: string,
    payload: Partial<CalendarEventPayload>,
  ): Promise<CalendarEventReference>;
  deleteEvent(externalEventId: string): Promise<void>;
  getEvent(externalEventId: string): Promise<CalendarEventPayload | null>;
}

/**
 * Standard contract verification suite that any calendar adapter must satisfy.
 */
export function describeCalendarAdapterContract(
  name: string,
  create: () => ICalendarAdapter,
): void {
  describe(`calendar adapter contract: ${name}`, () => {
    const samplePayload: CalendarEventPayload = {
      meetingId: 'meet-101',
      title: 'Sprint Planning',
      description: 'Discuss sprint goals and backlog priorities.',
      startTime: new Date('2026-11-04T10:00:00Z'),
      endTime: new Date('2026-11-04T11:00:00Z'),
      location: 'Conference Room Alpha',
      organizer: {
        name: 'Arun Kumar',
        email: 'arun.kumar@maxr.com',
      },
      attendees: [
        { name: 'Priya Sharma', email: 'priya.sharma@maxr.com', rsvpStatus: 'accepted' },
        { name: 'Marcus Brody', email: 'marcus.brody@maxr.com', rsvpStatus: 'needsAction' },
      ],
    };

    it('creates a calendar event and returns a valid reference', async () => {
      const adapter = create();
      const ref = await adapter.createEvent(samplePayload);

      expect(ref).toBeDefined();
      expect(typeof ref.externalEventId).toBe('string');
      expect(ref.externalEventId.length).toBeGreaterThan(0);
      expect(ref.syncedAt).toBeInstanceOf(Date);

      const fetched = await adapter.getEvent(ref.externalEventId);
      expect(fetched).not.toBeNull();
      expect(fetched?.title).toBe(samplePayload.title);
      expect(fetched?.meetingId).toBe(samplePayload.meetingId);
      expect(fetched?.attendees.length).toBe(2);
    });

    it('updates an existing event payload fields', async () => {
      const adapter = create();
      const created = await adapter.createEvent(samplePayload);

      const updatedRef = await adapter.updateEvent(created.externalEventId, {
        title: 'Sprint Planning (Rescheduled)',
        endTime: new Date('2026-11-04T11:30:00Z'),
      });

      expect(updatedRef.externalEventId).toBe(created.externalEventId);

      const fetched = await adapter.getEvent(created.externalEventId);
      expect(fetched?.title).toBe('Sprint Planning (Rescheduled)');
      expect(fetched?.endTime.toISOString()).toBe('2026-11-04T11:30:00.000Z');
      expect(fetched?.description).toBe(samplePayload.description); // Preserves unmodified fields
    });

    it('deletes an event and subsequent fetch returns null', async () => {
      const adapter = create();
      const created = await adapter.createEvent(samplePayload);

      await adapter.deleteEvent(created.externalEventId);

      const fetched = await adapter.getEvent(created.externalEventId);
      expect(fetched).toBeNull();
    });

    it('throws when updating a non-existent externalEventId', async () => {
      const adapter = create();
      await expect(
        adapter.updateEvent('non-existent-id', { title: 'New Title' }),
      ).rejects.toThrow();
    });
  });
}
