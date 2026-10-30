import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { TEST_PASSWORD } from '../auth/auth.testing';

let keyCounter = 0;
const nextKey = () => `shift-key-${++keyCounter}-${Date.now()}`;

const ORIGIN = 'http://localhost:3000';

const cookieOf = (res: request.Response): string => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return raw?.find((c) => c.startsWith('maxr_session=')) ?? '';
};
const cookieValue = (setCookie: string): string => setCookie.split(';')[0] ?? '';

async function signIn(
  app: Parameters<typeof request>[0],
  email = 'hr_manager@maxr.test',
  password = TEST_PASSWORD,
) {
  const res = await request(app)
    .post('/api/v1/auth/login')
    .set('Origin', ORIGIN)
    .send({ email, password });
  return { res, cookie: cookieValue(cookieOf(res)), csrf: res.body?.data?.csrfToken as string };
}

describe('TC-33: Shifts and Attendance Policies Module E2E', () => {
  const testEmployeeId = crypto.randomUUID();

  it('TC-33-01: HR creates shift and queries list successfully', async () => {
    const { app } = makeApp();
    const hrSession = await signIn(app, 'hr_manager@maxr.test');

    const createRes = await request(app)
      .post('/api/v1/shifts')
      .set('Cookie', hrSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', hrSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        name: 'Night Shift',
        code: `NS-${Date.now().toString().slice(-4)}`,
        startTime: '22:00:00',
        endTime: '06:30:00',
        breakMinutes: 45,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toMatchObject({
      name: 'Night Shift',
      startTime: '22:00:00',
      endTime: '06:30:00',
      breakMinutes: 45,
      isActive: true,
    });
    expect(createRes.body.data.id).toBeDefined();

    const listRes = await request(app).get('/api/v1/shifts').set('Cookie', hrSession.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });

  it('TC-33-02: duplicate shift code is rejected with 409 CONFLICT', async () => {
    const { app } = makeApp();
    const hrSession = await signIn(app, 'hr_manager@maxr.test');
    const code = `DUP-${Date.now().toString().slice(-4)}`;

    const firstRes = await request(app)
      .post('/api/v1/shifts')
      .set('Cookie', hrSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', hrSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        name: 'First Shift',
        code,
        startTime: '08:00:00',
        endTime: '16:00:00',
      });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post('/api/v1/shifts')
      .set('Cookie', hrSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', hrSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        name: 'Second Shift',
        code,
        startTime: '08:00:00',
        endTime: '16:00:00',
      });
    expect(secondRes.status).toBe(409);
    expect(secondRes.body.error.code).toBe('CONFLICT');
  });

  it('TC-33-03: non-HR staff attempting to create shift is rejected with 403 FORBIDDEN', async () => {
    const { app } = makeApp();
    const staffSession = await signIn(app, 'staff@maxr.test');

    const res = await request(app)
      .post('/api/v1/shifts')
      .set('Cookie', staffSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', staffSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        name: 'Staff Unauthorized Shift',
        code: `UNAUTH-${Date.now().toString().slice(-4)}`,
        startTime: '10:00:00',
        endTime: '18:00:00',
      });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('TC-33-04: HR assigns shift to employee and queries assigned shifts', async () => {
    const { app } = makeApp();
    const hrSession = await signIn(app, 'hr_manager@maxr.test');

    // 1. Get default shift
    const listRes = await request(app).get('/api/v1/shifts').set('Cookie', hrSession.cookie);
    const shiftId = listRes.body.data[0].id;

    // 2. Assign shift to employee
    const assignRes = await request(app)
      .post('/api/v1/shifts/assignments')
      .set('Cookie', hrSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', hrSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        employeeId: testEmployeeId,
        shiftId,
        effectiveFrom: '2026-11-01',
      });

    expect(assignRes.status).toBe(201);
    expect(assignRes.body.data).toMatchObject({
      employeeId: testEmployeeId,
      shiftId,
      effectiveFrom: '2026-11-01',
    });

    // 3. Query assigned shifts for employee
    const assignedList = await request(app)
      .get(`/api/v1/shifts/assignments/${testEmployeeId}`)
      .set('Cookie', hrSession.cookie);
    expect(assignedList.status).toBe(200);
    expect(assignedList.body.data.length).toBe(1);
    expect(assignedList.body.data[0].employeeId).toBe(testEmployeeId);
  });

  it('TC-33-05: HR updates and retrieves company attendance policy', async () => {
    const { app } = makeApp();
    const hrSession = await signIn(app, 'hr_manager@maxr.test');

    // 1. Get default policy
    const policyRes = await request(app)
      .get('/api/v1/shifts/policies')
      .set('Cookie', hrSession.cookie);
    expect(policyRes.status).toBe(200);
    expect(policyRes.body.data.gracePeriodMinutes).toBe(15);
    const policyId = policyRes.body.data.id;

    // 2. Update policy
    const updateRes = await request(app)
      .put('/api/v1/shifts/policies')
      .set('Cookie', hrSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', hrSession.csrf)
      .send({
        gracePeriodMinutes: 20,
        halfDayThresholdMinutes: 240,
        fullDayThresholdMinutes: 480,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.id).toBe(policyId);
    expect(updateRes.body.data.gracePeriodMinutes).toBe(20);
  });
});
