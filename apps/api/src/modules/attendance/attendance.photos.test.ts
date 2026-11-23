import { type Role } from '@maxr/shared';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { conflict } from '../../http/errors';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { InMemoryAttendanceRepository } from './attendance.repository.memory';
import { createAttendanceRouter } from './attendance.routes';
import { AttendanceService } from './attendance.service';

// A real (1x1) PNG and JPEG start with these bytes; the storage service checks them.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.from('not a full image, but it starts like one'),
]);
const PNG_URL = `data:image/png;base64,${PNG.toString('base64')}`;
const FAKE_PNG_URL = `data:image/png;base64,${Buffer.from('<html><script>alert(1)</script>').toString('base64')}`;

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const { users } = kit;
  // Staff reports to the Team Lead; the Admin and the HR Manager are outside that team.
  const repo = new InMemoryAttendanceRepository((id) =>
    id === users.staff.employeeId ? users.team_lead.employeeId : null,
  );
  const service = new AttendanceService(
    repo,
    platform.audit,
    undefined,
    undefined,
    undefined,
    platform.storage,
  );
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use(
    '/api/v1/attendance',
    createAttendanceRouter({
      authenticate: kit.auth.authenticate,
      audit: platform.audit,
      repository: repo,
      service,
      shiftResolver: undefined,
      storage: platform.storage,
    }),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { as, repo, platform, auditStore, users };
}

describe('attendance photos live in private storage, not in the table', () => {
  it('stores the photo as a file and keeps only a key on the record', async () => {
    const s = await setup();
    const res = await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL });
    expect(res.status).toBe(201);

    expect(res.body.data.hasCheckInPhoto).toBe(true);
    expect(res.body.data).not.toHaveProperty('checkInPhoto');
    expect(JSON.stringify(res.body)).not.toContain(PNG.toString('base64').slice(0, 20));

    const key = (await s.repo.findPhotoRef(res.body.data.id, 'check-in'))?.key;
    expect(key).toMatch(/^attendance-photos\/\d{4}\/\d{2}\//);
    expect(await s.platform.storage.exists(key!)).toBe(true);
  });

  it('never puts a photo in a list, only whether there is one', async () => {
    const s = await setup();
    await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL });
    await s.as.staff.post('/api/v1/attendance/check-out', { photoDataUrl: PNG_URL });

    const mine = await s.as.staff.get('/api/v1/attendance/me');
    const listed = await s.as.admin.get('/api/v1/attendance');
    for (const body of [mine.body, listed.body]) {
      expect(JSON.stringify(body)).not.toContain('data:image');
      expect(body.data[0]).toMatchObject({ hasCheckInPhoto: true, hasCheckOutPhoto: true });
    }
  });

  it('gives an allowed viewer a short-lived link that returns exactly the stored image', async () => {
    const s = await setup();
    const id = (await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL }))
      .body.data.id;

    const res = await s.as.admin.get(`/api/v1/attendance/${id}/photos/check-in`);
    expect(res.status).toBe(200);
    expect(res.body.data.url).toContain('/api/v1/files/download?token=');
    expect(new Date(res.body.data.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(120_000);

    const token = decodeURIComponent(res.body.data.url.split('token=')[1]);
    const opened = await s.platform.storage.openDownload(token, { subject: s.as.admin.userId });
    expect(opened.ok && opened.file.body.equals(PNG)).toBe(true);
    // The link is bound to the person it was issued to.
    expect((await s.platform.storage.openDownload(token, { subject: s.as.staff.userId })).ok).toBe(
      false,
    );
  });

  it('records who looked at a photo', async () => {
    const s = await setup();
    const id = (await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL }))
      .body.data.id;
    await s.as.team_lead.get(`/api/v1/attendance/${id}/photos/check-in`);
    expect(s.auditStore.find((e) => e.action === 'attendance.view_photo')).toMatchObject([
      { outcome: 'success', actorId: s.as.team_lead.userId, entityId: id },
    ]);
  });

  it('follows the same scope as the attendance list: Team Lead sees their team, not others', async () => {
    const s = await setup();
    const own = (await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL }))
      .body.data.id;
    const outside = (
      await s.as.admin.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL })
    ).body.data.id;

    expect((await s.as.team_lead.get(`/api/v1/attendance/${own}/photos/check-in`)).status).toBe(
      200,
    );
    // Out of scope looks exactly like missing.
    expect((await s.as.team_lead.get(`/api/v1/attendance/${outside}/photos/check-in`)).status).toBe(
      404,
    );
  });

  it('Staff cannot fetch photos through this route at all', async () => {
    const s = await setup();
    const id = (await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL }))
      .body.data.id;
    expect((await s.as.staff.get(`/api/v1/attendance/${id}/photos/check-in`)).status).toBe(403);
  });

  it('answers 404 when the record has no photo for that moment', async () => {
    const s = await setup();
    const id = (await s.as.staff.post('/api/v1/attendance/check-in', {})).body.data.id;
    expect((await s.as.admin.get(`/api/v1/attendance/${id}/photos/check-in`)).status).toBe(404);
    expect((await s.as.admin.get(`/api/v1/attendance/${id}/photos/check-out`)).status).toBe(404);
  });

  it('refuses an unknown moment or a malformed id', async () => {
    const s = await setup();
    expect((await s.as.admin.get('/api/v1/attendance/not-a-uuid/photos/check-in')).status).toBe(
      400,
    );
    const id = (await s.as.staff.post('/api/v1/attendance/check-in', {})).body.data.id;
    expect((await s.as.admin.get(`/api/v1/attendance/${id}/photos/selfie`)).status).toBe(400);
  });

  it('rejects an image that is not really an image, and then does not check anyone in', async () => {
    const s = await setup();
    const res = await s.as.staff.post('/api/v1/attendance/check-in', {
      photoDataUrl: FAKE_PNG_URL,
    });
    expect(res.status).toBe(400);
    expect((await s.as.staff.get('/api/v1/attendance/active')).body.data).toBeNull();
  });

  it('refuses a photo type the storage does not allow (webp)', async () => {
    const s = await setup();
    const res = await s.as.staff.post('/api/v1/attendance/check-in', {
      photoDataUrl: `data:image/webp;base64,${PNG.toString('base64')}`,
    });
    expect(res.status).toBe(400);
  });

  it('removes the stored file when the record cannot be written after the upload', async () => {
    const s = await setup();
    const stored: string[] = [];
    const original = s.platform.storage.upload.bind(s.platform.storage);
    s.platform.storage.upload = async (r) => {
      const out = await original(r);
      stored.push(out.key);
      return out;
    };
    // The race the up-front check cannot catch: a concurrent check-in wins between the two steps.
    s.repo.createCheckIn = async () => {
      throw conflict('An open attendance session already exists. Please check out first.');
    };

    const res = await s.as.staff.post('/api/v1/attendance/check-in', { photoDataUrl: PNG_URL });
    expect(res.status).toBe(409);
    expect(stored).toHaveLength(1);
    expect(await s.platform.storage.exists(stored[0]!)).toBe(false);
  });
});
