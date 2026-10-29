import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';

let keyCounter = 0;
const nextKey = () => `att-key-${++keyCounter}-${Date.now()}`;

describe('TC-34: Attendance Check-In / Check-Out Module E2E', () => {
  const testEmployeeId = 'a1111111-1111-1111-1111-111111111111';

  it('TC-34-01: complete attendance session lifecycle (check-in -> active -> check-out -> history)', async () => {
    const { app } = makeApp();

    // 1. Initial active check should be null
    const initialActive = await request(app)
      .get('/api/v1/attendance/active')
      .set('x-employee-id', testEmployeeId);
    expect(initialActive.status).toBe(200);
    expect(initialActive.body.data).toBeNull();

    // 2. Perform Check-In
    const checkInRes = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', testEmployeeId)
      .send({
        notes: 'Morning shift check-in from office',
        location: { latitude: 12.9716, longitude: 77.5946, address: 'Bangalore HQ' },
      });

    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.data).toMatchObject({
      employeeId: testEmployeeId,
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
      .set('x-employee-id', testEmployeeId);
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.id).toBe(sessionId);
    expect(activeRes.body.data.checkOutTime).toBeNull();

    // 4. Today summary endpoint should reflect ongoing attendance
    const todayRes = await request(app)
      .get('/api/v1/attendance/today')
      .set('x-employee-id', testEmployeeId);
    expect(todayRes.status).toBe(200);
    expect(todayRes.body.data.activeSession.id).toBe(sessionId);
    expect(todayRes.body.data.status).toBe('PRESENT');

    // 5. Perform Check-Out
    const checkOutRes = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', testEmployeeId)
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
      .set('x-employee-id', testEmployeeId);
    expect(postActiveRes.status).toBe(200);
    expect(postActiveRes.body.data).toBeNull();

    // 7. Today summary should show completed session
    const postTodayRes = await request(app)
      .get('/api/v1/attendance/today')
      .set('x-employee-id', testEmployeeId);
    expect(postTodayRes.status).toBe(200);
    expect(postTodayRes.body.data.activeSession).toBeNull();
    expect(postTodayRes.body.data.completedSessions.length).toBe(1);

    // 8. History endpoint should list the completed record
    const historyRes = await request(app)
      .get('/api/v1/attendance/history')
      .set('x-employee-id', testEmployeeId);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.data.length).toBe(1);
    expect(historyRes.body.meta.total).toBe(1);
  });

  it('TC-34-02: duplicate check-in rejected with 409 CONFLICT (partial unique index invariant)', async () => {
    const { app } = makeApp();
    const empId = 'b2222222-2222-2222-2222-222222222222';

    // First check-in succeeds
    const firstCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', empId)
      .send({});
    expect(firstCheckIn.status).toBe(201);

    // Second check-in while first is still open MUST fail with 409
    const secondCheckIn = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', empId)
      .send({});

    expect(secondCheckIn.status).toBe(409);
    expect(secondCheckIn.body.error.code).toBe('CONFLICT');
    expect(secondCheckIn.body.error.message).toMatch(/already open/i);
  });

  it('TC-34-03: check-out without active session rejected with 409 CONFLICT', async () => {
    const { app } = makeApp();
    const empId = 'c3333333-3333-3333-3333-333333333333';

    const checkOutRes = await request(app)
      .post('/api/v1/attendance/check-out')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', empId)
      .send({});

    expect(checkOutRes.status).toBe(409);
    expect(checkOutRes.body.error.code).toBe('CONFLICT');
    expect(checkOutRes.body.error.message).toMatch(/No active attendance session/i);
  });

  it('TC-34-04: input validation rejects invalid coordinates or unknown fields', async () => {
    const { app } = makeApp();
    const empId = 'd4444444-4444-4444-4444-444444444444';

    // Latitude out of range (>90)
    const invalidCoords = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', empId)
      .send({ location: { latitude: 95.0, longitude: 20.0 } });

    expect(invalidCoords.status).toBe(400);
    expect(invalidCoords.body.error.code).toBe('VALIDATION_ERROR');

    // Extra forbidden property (strict schema)
    const extraProp = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', nextKey())
      .set('x-employee-id', empId)
      .send({ invalidField: 'hack' });

    expect(extraProp.status).toBe(400);
    expect(extraProp.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TC-34-05: Idempotency-Key replays identical response without double check-in', async () => {
    const { app } = makeApp();
    const empId = 'e5555555-5555-5555-5555-555555555555';
    const sameKey = nextKey();

    const call1 = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', sameKey)
      .set('x-employee-id', empId)
      .send({ notes: 'Idempotent test' });
    expect(call1.status).toBe(201);

    // Retry with identical key
    const call2 = await request(app)
      .post('/api/v1/attendance/check-in')
      .set('Idempotency-Key', sameKey)
      .set('x-employee-id', empId)
      .send({ notes: 'Idempotent test' });

    // Should replay 201 without creating conflict
    expect(call2.status).toBe(201);
    expect(call2.body.data.id).toBe(call1.body.data.id);
  });
});
