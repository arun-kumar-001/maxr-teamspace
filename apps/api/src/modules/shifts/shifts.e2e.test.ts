import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';

let keyCounter = 0;
const nextKey = () => `shift-key-${++keyCounter}-${Date.now()}`;

describe('TC-33: Shifts and Attendance Policies Module E2E', () => {
  const hrId = crypto.randomUUID();
  const staffId = crypto.randomUUID();
  const testEmployeeId = crypto.randomUUID();

  it('TC-33-01: HR creates shift and queries list successfully', async () => {
    const { app } = makeApp();

    const createRes = await request(app)
      .post('/api/v1/shifts')
      .set('Idempotency-Key', nextKey())
      .set('x-role', 'HR Manager')
      .set('x-employee-id', hrId)
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

    const listRes = await request(app).get('/api/v1/shifts');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.length).toBeGreaterThan(0);
  });

  it('TC-33-02: duplicate shift code is rejected with 409 CONFLICT', async () => {
    const { app } = makeApp();
    const code = `DUP-${Date.now().toString().slice(-4)}`;

    const firstRes = await request(app)
      .post('/api/v1/shifts')
      .set('Idempotency-Key', nextKey())
      .set('x-role', 'HR Manager')
      .send({
        name: 'First Shift',
        code,
        startTime: '08:00:00',
        endTime: '16:00:00',
      });
    expect(firstRes.status).toBe(201);

    const secondRes = await request(app)
      .post('/api/v1/shifts')
      .set('Idempotency-Key', nextKey())
      .set('x-role', 'HR Manager')
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

    const res = await request(app)
      .post('/api/v1/shifts')
      .set('Idempotency-Key', nextKey())
      .set('x-role', 'Staff')
      .set('x-employee-id', staffId)
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

    // 1. Get default shift
    const listRes = await request(app).get('/api/v1/shifts');
    const shiftId = listRes.body.data[0].id;

    // 2. Assign employee to shift
    const assignRes = await request(app)
      .post('/api/v1/shifts/assignments')
      .set('Idempotency-Key', nextKey())
      .set('x-role', 'HR Manager')
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

    // 3. Query employee shifts
    const getAssignRes = await request(app).get(`/api/v1/shifts/assignments/${testEmployeeId}`);
    expect(getAssignRes.status).toBe(200);
    expect(getAssignRes.body.data.length).toBe(1);
    expect(getAssignRes.body.data[0].shiftId).toBe(shiftId);
  });

  it('TC-33-05: HR updates and retrieves company attendance policy', async () => {
    const { app } = makeApp();

    const getRes = await request(app).get('/api/v1/shifts/policies');
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.gracePeriodMinutes).toBeDefined();

    const updateRes = await request(app)
      .put('/api/v1/shifts/policies')
      .set('x-role', 'HR Manager')
      .send({
        gracePeriodMinutes: 20,
        halfDayThresholdMinutes: 210,
        fullDayThresholdMinutes: 450,
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.gracePeriodMinutes).toBe(20);
    expect(updateRes.body.data.halfDayThresholdMinutes).toBe(210);
    expect(updateRes.body.data.fullDayThresholdMinutes).toBe(450);
  });
});
