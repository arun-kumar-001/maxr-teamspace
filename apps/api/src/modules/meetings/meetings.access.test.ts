import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import {
  ALL_ROLES,
  SignedIn,
  expectNoExistenceLeak,
  listRoutes,
  signInAs,
} from '../rbac/rbac.testing';
import { createMeetings } from './index';
import { MemoryMeetingsRepository } from './meetings.repository.memory';

const MISSING = '8b000000-0000-4000-8000-000000000999';
const AWAY = '8b000000-0000-4000-8000-000000000050';
// Fixed "now": 1 November 2026, 10:00 UTC. Meetings are scheduled for 2026-11-10 unless a test says otherwise.
const NOW = new Date('2026-11-01T10:00:00Z');
const WHEN = { startsAt: '2026-11-10T04:00:00Z', endsAt: '2026-11-10T05:00:00Z' };

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;
  const repo = new MemoryMeetingsRepository();
  for (const role of ALL_ROLES) {
    repo.names[id(role)] = `${role} person`;
    repo.active.add(id(role));
  }
  const events: Array<{ type: string; payload: unknown }> = [];
  for (const type of ['meetings.invited', 'meetings.cancelled', 'meetings.reminder_due']) {
    platform.events.subscribe(
      type,
      (event) => void events.push({ type: event.type, payload: event.payload }),
    );
  }
  const meetings = createMeetings({
    platform,
    authenticate: kit.auth.authenticate,
    repository: repo,
    clock: () => NOW,
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/meetings', meetings.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const schedule = (who: Role, extra: object = {}) =>
    as[who]
      .post('/api/v1/meetings', {
        title: 'Sprint review',
        ...WHEN,
        inviteeIds: [id('staff')],
        ...extra,
      })
      .set('Idempotency-Key', `meet-${who}-${++n}-abcdefgh`);
  return { app, as, kit, id, repo, events, auditStore, schedule, meetings };
}

describe('meetings API: access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/meetings?from=2026-11-01T00:00:00Z&to=2026-11-02T00:00:00Z'],
      ['post', '/api/v1/meetings'],
      ['get', `/api/v1/meetings/${MISSING}`],
      ['put', `/api/v1/meetings/${MISSING}`],
      ['post', `/api/v1/meetings/${MISSING}/cancel`],
      ['post', `/api/v1/meetings/${MISSING}/rsvp`],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it('declares a permission on every route', async () => {
    const { app } = await setup();
    const routes = listRoutes(app).filter((r) => r.path.startsWith('/api/v1/meetings'));
    expect(routes).toHaveLength(6);
    for (const route of routes) expect(route.access, `${route.method} ${route.path}`).toBeDefined();
  });

  describe('scheduling (D-18: Team Lead, HR Manager and Admin schedule; Staff are invited only)', () => {
    it.each([
      ['admin', 201],
      ['hr_manager', 201],
      ['team_lead', 201],
      ['staff', 403],
    ] as Array<[Role, number]>)('%s scheduling gets %i', async (role, status) => {
      const { schedule } = await setup();
      expect((await schedule(role)).status).toBe(status);
    });

    it('makes the caller the organizer, invites the others, and tells each invitee once', async () => {
      const { schedule, id, events } = await setup();
      const res = await schedule('team_lead', { inviteeIds: [id('staff'), id('hr_manager')] });
      expect(res.body.data.meeting).toMatchObject({
        organizerEmployeeId: id('team_lead'),
        status: 'scheduled',
        version: 1,
      });
      expect(
        res.body.data.meeting.attendees.map((a: { employeeId: string }) => a.employeeId).sort(),
      ).toEqual([id('hr_manager'), id('staff')].sort());
      expect(events).toEqual([
        expect.objectContaining({
          type: 'meetings.invited',
          payload: expect.objectContaining({ inviteeEmployeeIds: [id('staff'), id('hr_manager')] }),
        }),
      ]);
    });

    it('lists the organizer among the invitees only when they are invited', async () => {
      const { schedule, id } = await setup();
      const res = await schedule('team_lead', { inviteeIds: [id('team_lead')] });
      expect(
        res.body.data.meeting.attendees.map((a: { employeeId: string }) => a.employeeId),
      ).toEqual([]);
    });

    it('returns overlaps as warnings, and does not refuse the meeting', async () => {
      const { schedule, id } = await setup();
      await schedule('team_lead', { inviteeIds: [id('staff')] });
      const second = await schedule('admin', {
        inviteeIds: [id('staff')],
        startsAt: '2026-11-10T04:30:00Z',
        endsAt: '2026-11-10T05:30:00Z',
      });
      expect(second.status).toBe(201);
      expect(second.body.data.overlaps).toEqual([
        expect.objectContaining({ employeeId: id('staff') }),
      ]);
    });

    it('answers no overlaps for meetings that touch but do not overlap', async () => {
      const { schedule, id } = await setup();
      await schedule('team_lead', { inviteeIds: [id('staff')] });
      const after = await schedule('admin', {
        inviteeIds: [id('staff')],
        startsAt: '2026-11-10T05:00:00Z',
        endsAt: '2026-11-10T06:00:00Z',
      });
      expect(after.body.data.overlaps).toEqual([]);
    });

    it.each([
      [
        'an end before the start',
        { startsAt: '2026-11-10T05:00:00Z', endsAt: '2026-11-10T04:00:00Z' },
      ],
      [
        'a meeting longer than a day',
        { startsAt: '2026-11-10T04:00:00Z', endsAt: '2026-11-11T05:00:00Z' },
      ],
      ['a start in the past', { startsAt: '2026-10-30T04:00:00Z', endsAt: '2026-10-30T05:00:00Z' }],
    ])('refuses %s with 422', async (_name, patch) => {
      const { schedule } = await setup();
      expect((await schedule('team_lead', patch)).status).toBe(422);
    });

    it('refuses more than 100 invitees and an invitee who is not active, with 422', async () => {
      const { schedule, repo } = await setup();
      const many = Array.from(
        { length: 101 },
        (_, i) => `8c000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
      );
      // The schema's limit of 100 answers first.
      expect((await schedule('team_lead', { inviteeIds: many })).status).toBe(400);
      expect((await schedule('team_lead', { inviteeIds: [AWAY] })).status).toBe(422);
      expect(repo.meetings).toHaveLength(0);
    });

    it('needs an Idempotency-Key-free body that is strict: an unknown field is a 400', async () => {
      const { as } = await setup();
      expect(
        (
          await as.team_lead.post('/api/v1/meetings', {
            ...WHEN,
            title: 'x',
            organizerEmployeeId: MISSING,
          })
        ).status,
      ).toBe(400);
    });

    it('audits the meeting without its title or agenda', async () => {
      const { schedule, auditStore } = await setup();
      await schedule('team_lead', { title: 'Acquisition of Acme', agenda: 'Price discussion' });
      const entries = auditStore.find((e) => e.action === 'meeting.schedule');
      expect(entries).toHaveLength(1);
      expect(JSON.stringify(entries)).not.toMatch(/Acme|Price/);
    });
  });

  describe('reading (organizer and invitees only; anyone else gets a 404)', () => {
    it('shows a meeting to its organizer and invitees, and to nobody else', async () => {
      const { schedule, as, id } = await setup();
      const created = await schedule('team_lead', { inviteeIds: [id('staff')] });
      const meetingId = created.body.data.meeting.id as string;
      expect((await as.team_lead.get(`/api/v1/meetings/${meetingId}`)).status).toBe(200);
      expect((await as.staff.get(`/api/v1/meetings/${meetingId}`)).status).toBe(200);
      expectNoExistenceLeak(
        await as.hr_manager.get(`/api/v1/meetings/${meetingId}`),
        await as.hr_manager.get(`/api/v1/meetings/${MISSING}`),
      );
      expect((await as.staff.get('/api/v1/meetings/not-a-uuid')).status).toBe(400);
    });

    it('lists only the meetings the caller organises or is invited to, in the window', async () => {
      const { schedule, as, id } = await setup();
      await schedule('team_lead', { inviteeIds: [id('staff')] });
      await schedule('admin', {
        inviteeIds: [id('hr_manager')],
        startsAt: '2026-11-20T04:00:00Z',
        endsAt: '2026-11-20T05:00:00Z',
      });
      const window = '?from=2026-11-01T00:00:00Z&to=2026-11-30T00:00:00Z';
      const staff = await as.staff.get(`/api/v1/meetings${window}`);
      expect(staff.body.data.map((m: { myRole: string }) => m.myRole)).toEqual(['invitee']);
      expect(staff.body.meta.total).toBe(1);
      const lead = await as.team_lead.get(`/api/v1/meetings${window}`);
      expect(lead.body.data).toHaveLength(1);
      expect(lead.body.data[0].myRole).toBe('organizer');
      expect(
        (await as.staff.get(`/api/v1/meetings?from=2026-11-01T00:00:00Z&to=2026-11-30T00:00:00Z`))
          .body.meta.total,
      ).toBe(1);
      expect(
        (await as.staff.get('/api/v1/meetings?from=2026-11-10T00:00:00Z&to=2026-11-01T00:00:00Z'))
          .status,
      ).toBe(400);
      expect(
        (await as.staff.get('/api/v1/meetings?from=2026-11-01T00:00:00Z&to=2027-02-01T00:00:00Z'))
          .status,
      ).toBe(400);
    });
  });

  describe('answering (RSVP)', () => {
    it('lets an invitee accept, decline or be tentative, and shows the answer', async () => {
      const { schedule, as, id } = await setup();
      const meetingId = (await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data
        .meeting.id as string;
      const res = await as.staff.post(`/api/v1/meetings/${meetingId}/rsvp`, {
        response: 'tentative',
      });
      expect(res.status).toBe(200);
      expect(res.body.data.attendees[0]).toMatchObject({
        rsvp: 'tentative',
        respondedAt: expect.any(String),
      });
      expect(
        (await as.staff.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'declined' })).body
          .data.attendees[0].rsvp,
      ).toBe('declined');
    });

    it('refuses an answer from someone not invited (404) and from the organizer (404), and a bad answer (400)', async () => {
      const { schedule, as, id } = await setup();
      const meetingId = (await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data
        .meeting.id as string;
      expect(
        (await as.hr_manager.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'accepted' }))
          .status,
      ).toBe(404);
      expect(
        (await as.team_lead.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'accepted' }))
          .status,
      ).toBe(404);
      expect(
        (await as.staff.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'maybe' })).status,
      ).toBe(400);
    });

    it('a cancelled meeting takes no answers', async () => {
      const { schedule, as, id } = await setup();
      const meetingId = (await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data
        .meeting.id as string;
      await as.team_lead.post(`/api/v1/meetings/${meetingId}/cancel`);
      expect(
        (await as.staff.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'accepted' }))
          .status,
      ).toBe(422);
    });
  });

  describe('changing and cancelling (the organizer only)', () => {
    it('lets the organizer change the time, agenda and minutes, bumps the version and keeps minutes out of the trail', async () => {
      const { schedule, as, id, auditStore } = await setup();
      const created = await schedule('team_lead', { inviteeIds: [id('staff')], agenda: 'Q3 plan' });
      const url = `/api/v1/meetings/${created.body.data.meeting.id}`;
      const res = await as.team_lead.put(url, {
        startsAt: '2026-11-11T04:00:00Z',
        endsAt: '2026-11-11T05:00:00Z',
        minutes: 'Decided to hire two people',
        version: 1,
      });
      expect(res.status).toBe(200);
      expect(res.body.data.meeting).toMatchObject({
        version: 2,
        startsAt: '2026-11-11T04:00:00.000Z',
      });
      expect(res.body.data.meeting.minutes).toBe('Decided to hire two people');
      const entry = auditStore.find((e) => e.action === 'meeting.update')[0];
      expect(JSON.stringify(entry)).not.toMatch(/hire|Q3 plan/);
    });

    it('refuses an edit from anyone but the organizer (403), a stale version (409), and an edit of a cancelled meeting (409)', async () => {
      const { schedule, as, id } = await setup();
      const url = `/api/v1/meetings/${(await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data.meeting.id}`;
      // Only the organizer and invitees see a meeting, so an Admin who is neither gets a 404 (D-18).
      expect((await as.admin.put(url, { title: 'x', version: 1 })).status).toBe(404);
      // An invited HR Manager may schedule, so the 403 comes from the organizer check in the service, not the route.
      const invited = await schedule('team_lead', { inviteeIds: [id('hr_manager')] });
      const hrUrl = `/api/v1/meetings/${invited.body.data.meeting.id}`;
      expect((await as.hr_manager.put(hrUrl, { title: 'x', version: 1 })).status).toBe(403);
      expect((await as.team_lead.put(url, { title: 'First', version: 1 })).status).toBe(200);
      expect((await as.team_lead.put(url, { title: 'Second', version: 1 })).status).toBe(409);
      await as.team_lead.post(`${url}/cancel`);
      expect((await as.team_lead.put(url, { title: 'Late', version: 3 })).status).toBe(409);
    });

    it('refuses to invite someone who is not active when the meeting is changed (422)', async () => {
      const { schedule, as, id } = await setup();
      const url = `/api/v1/meetings/${(await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data.meeting.id}`;
      expect((await as.team_lead.put(url, { inviteeIds: [AWAY], version: 1 })).status).toBe(422);
    });

    it('invites newly added people only, and drops those removed', async () => {
      const { schedule, as, id, events } = await setup();
      const url = `/api/v1/meetings/${(await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data.meeting.id}`;
      events.length = 0;
      const res = await as.team_lead.put(url, { inviteeIds: [id('hr_manager')], version: 1 });
      expect(
        res.body.data.meeting.attendees.map((a: { employeeId: string }) => a.employeeId),
      ).toEqual([id('hr_manager')]);
      expect(events).toEqual([
        expect.objectContaining({
          type: 'meetings.invited',
          payload: expect.objectContaining({ inviteeEmployeeIds: [id('hr_manager')] }),
        }),
      ]);
    });

    it('refuses a minutes text over 20,000 characters, and an empty change, with 400', async () => {
      const { schedule, as, id } = await setup();
      const url = `/api/v1/meetings/${(await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data.meeting.id}`;
      expect((await as.team_lead.put(url, { minutes: 'x'.repeat(20001), version: 1 })).status).toBe(
        400,
      );
      expect((await as.team_lead.put(url, { version: 1 })).status).toBe(400);
    });

    it('the organizer cancels once; the invitees are told', async () => {
      const { schedule, as, id, events } = await setup();
      const url = `/api/v1/meetings/${(await schedule('team_lead', { inviteeIds: [id('staff')] })).body.data.meeting.id}`;
      events.length = 0;
      const cancelled = await as.team_lead.post(`${url}/cancel`);
      expect(cancelled.body.data.status).toBe('cancelled');
      expect(events).toEqual([
        expect.objectContaining({
          type: 'meetings.cancelled',
          payload: expect.objectContaining({ inviteeEmployeeIds: [id('staff')] }),
        }),
      ]);
      expect((await as.team_lead.post(`${url}/cancel`)).status).toBe(409);
      // Invited, so the meeting is visible to them, but only the organizer may cancel it.
      const invited = await schedule('team_lead', { inviteeIds: [id('hr_manager')] });
      expect(
        (await as.hr_manager.post(`/api/v1/meetings/${invited.body.data.meeting.id}/cancel`))
          .status,
      ).toBe(403);
    });
  });

  describe('reminders (D-18: 15 minutes before, to invitees who have not declined)', () => {
    it('reminds the invitees who have not declined, once, when the meeting is about to start', async () => {
      const { schedule, as, id, meetings, events } = await setup();
      const soon = { startsAt: '2026-11-01T10:10:00Z', endsAt: '2026-11-01T11:00:00Z' };
      const created = await schedule('team_lead', {
        ...soon,
        inviteeIds: [id('staff'), id('hr_manager')],
      });
      const meetingId = created.body.data.meeting.id as string;
      await as.hr_manager.post(`/api/v1/meetings/${meetingId}/rsvp`, { response: 'declined' });
      events.length = 0;
      expect(await meetings.service.sendReminders(NOW)).toBe(1);
      expect(events).toEqual([
        expect.objectContaining({
          type: 'meetings.reminder_due',
          payload: expect.objectContaining({ inviteeEmployeeIds: [id('staff')] }),
        }),
      ]);
      expect(await meetings.service.sendReminders(NOW)).toBe(0);
    });

    it('does not remind a meeting that is more than 15 minutes away', async () => {
      const { schedule, id, meetings } = await setup();
      await schedule('team_lead', { inviteeIds: [id('staff')] }); // starts 10 November
      expect(await meetings.service.sendReminders(NOW)).toBe(0);
    });
  });
});
