import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { TEST_PASSWORD } from '../auth/auth.testing';

let keyCounter = 0;
const nextKey = () => `att-key-${++keyCounter}-${Date.now()}`;

const ORIGIN = 'http://localhost:3000';

const cookieOf = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('maxr_session=')) ?? '';
};
const cookieValue = (setCookie: string): string => setCookie.split(';')[0] ?? '';

async function signIn(
  app: Parameters<typeof request>[0],
  email = 'staff@maxr.test',
  password = TEST_PASSWORD,
) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password });
  return { res, cookie: cookieValue(cookieOf(res)), csrf: res.body?.data?.csrfToken as string };
}

describe('TC-34: Attendance Check-In / Check-Out Module E2E', () => {
  it('TC-34-AUTH: unauthenticated request is rejected with 401 UNAUTHORIZED', async () => {
    const { app } = makeApp();

    const res = await request(app).get('/api/v1/attendance/active');
    expect(res.status).toBe(401);

    const postRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Origin', ORIGIN)
      .send({ notes: 'unauthenticated' });
    expect(postRes.status).toBe(401);
  });

  it('TC-34-01: complete attendance session lifecycle (check-in -> active -> check-out -> history)', async () => {
    const { app, authKit } = makeApp();
    const session = await signIn(app, 'staff@maxr.test');
    const staffEmployeeId = authKit.users.staff.employeeId;

    // 1. Initial active check should be null
    const initialActive = await request(app)
      .get('/api/v1/attendance/active')
      .set('Cookie', session.cookie);
    expect(initialActive.status).toBe(200);
    expect(initialActive.body.data).toBeNull();

    // 2. Perform Check-In
    const checkInRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        notes: 'Morning shift check-in from office',
        location: { latitude: 12.9716, longitude: 77.5946, address: 'Bangalore HQ' },
      });

    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.data).toMatchObject({
      employeeId: staffEmployeeId,
      status: 'PRESENT',
      checkOutTime: null,
      notes: 'Morning shift check-in from office',
    });
    expect(checkInRes.body.data.id).toBeDefined();
    expect(checkInRes.body.data.checkInTime).toBeDefined();
    const sessionId = checkInRes.body.data.id;

    // 3. Active endpoint should now return this active session
    const activeRes = await request(app)
      .get('/api/v1/attendance/active')
      .set('Cookie', session.cookie);
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.id).toBe(sessionId);
    expect(activeRes.body.data.checkOutTime).toBeNull();

    // 4. Today summary endpoint should reflect ongoing attendance
    const todayRes = await request(app)
      .get('/api/v1/attendance/today')
      .set('Cookie', session.cookie);
    expect(todayRes.status).toBe(200);
    expect(todayRes.body.data.activeSession.id).toBe(sessionId);
    expect(todayRes.body.data.status).toBe('PRESENT');

    // 5. Perform Check-Out
    const checkOutRes = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        notes: 'End of shift check-out',
      });

    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.data.id).toBe(sessionId);
    expect(checkOutRes.body.data.checkOutTime).not.toBeNull();
    expect(checkOutRes.body.data.durationMinutes).toBeGreaterThanOrEqual(0);

    // 6. Active endpoint should now return null again
    const postActiveRes = await request(app)
      .get('/api/v1/attendance/active')
      .set('Cookie', session.cookie);
    expect(postActiveRes.status).toBe(200);
    expect(postActiveRes.body.data).toBeNull();

    // 7. Today summary should show completed session
    const postTodayRes = await request(app)
      .get('/api/v1/attendance/today')
      .set('Cookie', session.cookie);
    expect(postTodayRes.status).toBe(200);
    expect(postTodayRes.body.data.activeSession).toBeNull();
    expect(postTodayRes.body.data.completedSessions.length).toBe(1);

    // 8. History endpoint should list the completed record
    const historyRes = await request(app)
      .get('/api/v1/attendance/history')
      .set('Cookie', session.cookie);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.meta.total).toBe(1);
  });

  it('TC-34-02: duplicate check-in rejected with 409 CONFLICT (partial unique index invariant)', async () => {
    const { app } = makeApp();
    const session = await signIn(app, 'staff@maxr.test');

    // First check-in succeeds
    const first = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ notes: 'First valid check-in' });
    expect(first.status).toBe(201);

    // Second check-in without check-out must fail with 409
    const second = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ notes: 'Duplicate invalid check-in' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('TC-34-03: check-out without active session rejected with 409 CONFLICT', async () => {
    const { app } = makeApp();
    const session = await signIn(app, 'staff@maxr.test');

    const res = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ notes: 'Premature checkout' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('TC-34-04: input validation rejects invalid coordinates or unknown fields', async () => {
    const { app } = makeApp();
    const session = await signIn(app, 'staff@maxr.test');

    // Invalid latitude (> 90)
    const badCoordRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        location: { latitude: 95.0, longitude: 50.0 },
      });
    expect(badCoordRes.status).toBe(400);
    expect(badCoordRes.body.error.code).toBe('VALIDATION_ERROR');

    // Strips or rejects unknown fields
    const unknownFieldRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        notes: 'Valid note',
        maliciousProp: 'attempted injection',
      });
    expect(unknownFieldRes.status).toBe(400);
  });

  it('TC-34-05: Idempotency-Key replays identical response without double check-in', async () => {
    const { app } = makeApp();
    const session = await signIn(app, 'staff@maxr.test');
    const sharedKey = nextKey();

    const first = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', sharedKey)
      .send({ notes: 'Idempotency test call' });
    expect(first.status).toBe(201);
    const firstId = first.body.data.id;

    // Replay with exact same idempotency key
    const replay = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Cookie', session.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', session.csrf)
      .set('Idempotency-Key', sharedKey)
      .send({ notes: 'Idempotency test call' });
    expect(replay.status).toBe(201);
    expect(replay.body.data.id).toBe(firstId);
  });

  describe('TC-35: Attendance Views and History (own, team, HR)', () => {
    it('TC-35-01: staff can query own attendance history via GET /attendance/me', async () => {
      const { app, authKit } = makeApp();
      const session = await signIn(app, 'staff@maxr.test');
      const staffEmployeeId = authKit.users.staff.employeeId;

      await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Cookie', session.cookie)
        .set('Origin', ORIGIN)
        .set('x-csrf-token', session.csrf)
        .set('Idempotency-Key', nextKey())
        .send({ notes: 'Session 1' });

      const res = await request(app).get('/api/v1/attendance/me').set('Cookie', session.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].employeeId).toBe(staffEmployeeId);
    });

    it('TC-35-02: staff querying peer attendance is rejected with 403 FORBIDDEN', async () => {
      const { app } = makeApp();
      const session = await signIn(app, 'staff@maxr.test');
      const peerId = '00000000-0000-4000-9000-000000000009';

      const res = await request(app)
        .get(`/api/v1/attendance?employeeId=${peerId}`)
        .set('Cookie', session.cookie);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('TC-35-03: team lead can view team members attendance grid', async () => {
      const { app } = makeApp();
      const leadSession = await signIn(app, 'team_lead@maxr.test');
      const staffSession = await signIn(app, 'staff@maxr.test');

      // Staff member checks in
      await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Cookie', staffSession.cookie)
        .set('Origin', ORIGIN)
        .set('x-csrf-token', staffSession.csrf)
        .set('Idempotency-Key', nextKey())
        .send({ notes: 'Staff check in' });

      // Lead queries attendance
      const res = await request(app).get('/api/v1/attendance').set('Cookie', leadSession.cookie);
      expect(res.status).toBe(200);
      expect(res.body.meta).toBeDefined();
    });

    it('TC-35-04: HR manager can view company-wide attendance', async () => {
      const { app } = makeApp();
      const hrSession = await signIn(app, 'hr_manager@maxr.test');
      const staffSession = await signIn(app, 'staff@maxr.test');

      await request(app)
        .post('/api/v1/attendance/check-in')
        .set('Cookie', staffSession.cookie)
        .set('Origin', ORIGIN)
        .set('x-csrf-token', staffSession.csrf)
        .set('Idempotency-Key', nextKey())
        .send({ notes: 'Staff check in for HR view' });

      const res = await request(app).get('/api/v1/attendance').set('Cookie', hrSession.cookie);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });
});
