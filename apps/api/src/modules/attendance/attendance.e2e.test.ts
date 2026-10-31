import express from 'express';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import { signInAs } from '../rbac/rbac.testing';
import { InMemoryAttendanceRepository } from './attendance.repository.memory';
import { createAttendanceRouter } from './attendance.routes';
import { AttendanceService } from './attendance.service';

async function setup(isEmployeeActive: (id: string) => boolean = () => true) {
  const { platform } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const kit = createTestAuth(platform.audit);
  const repo = new InMemoryAttendanceRepository();
  const service = new AttendanceService(repo, platform.audit, undefined, isEmployeeActive);

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
    }),
  );
  app.use(notFoundHandler);
  app.use(createErrorHandler(createLogger({ level: 'silent', write: () => undefined })));

  const staff = await signInAs(app, kit, 'staff');
  return { app, staff, repo, kit };
}

describe('attendance module end to end lifecycle (Issue #34)', () => {
  it('handles full check-in and check-out lifecycle with server timestamps', async () => {
    const { staff } = await setup();

    // 1. Initially no active session
    const initialActive = await staff.get('/api/v1/attendance/active');
    expect(initialActive.status).toBe(200);
    expect(initialActive.body.data).toBeNull();

    // 2. Check in
    const checkInRes = await staff.post('/api/v1/attendance/check-in', {
      location: { workMode: 'office', address: 'Headquarters' },
      notes: 'Morning shift',
    });
    expect(checkInRes.status).toBe(201);
    expect(checkInRes.body.data.id).toBeDefined();
    expect(checkInRes.body.data.status).toBe('present');
    expect(checkInRes.body.data.checkOutTime).toBeNull();

    // 3. Active session now exists
    const activeRes = await staff.get('/api/v1/attendance/active');
    expect(activeRes.status).toBe(200);
    expect(activeRes.body.data.id).toBe(checkInRes.body.data.id);

    // 4. Duplicate check-in is rejected with 409 Conflict
    const dupRes = await staff.post('/api/v1/attendance/check-in', { notes: 'second attempt' });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('CONFLICT');

    // 5. Today summary reflects active session
    const todayRes = await staff.get('/api/v1/attendance/today');
    expect(todayRes.status).toBe(200);
    expect(todayRes.body.data.sessionsCount).toBe(1);
    expect(todayRes.body.data.activeSession.id).toBe(checkInRes.body.data.id);

    // 6. Check out
    const checkOutRes = await staff.post('/api/v1/attendance/check-out', { notes: 'Day complete' });
    expect(checkOutRes.status).toBe(200);
    expect(checkOutRes.body.data.checkOutTime).not.toBeNull();
    expect(checkOutRes.body.data.durationMinutes).toBeDefined();

    // 7. Active session is now null
    const afterActive = await staff.get('/api/v1/attendance/active');
    expect(afterActive.status).toBe(200);
    expect(afterActive.body.data).toBeNull();

    // 8. Checking out again when no active session exists returns 400 Bad Request
    const noSessionCheckout = await staff.post('/api/v1/attendance/check-out', {});
    expect(noSessionCheckout.status).toBe(400);
    expect(noSessionCheckout.body.error.code).toBe('BAD_REQUEST');
  });

  it('rejects check-in for deactivated employee with 403 Forbidden', async () => {
    const { staff } = await setup((_id) => false);
    const res = await staff.post('/api/v1/attendance/check-in', { notes: 'should fail' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('allows second session of the day after first session is closed', async () => {
    const { staff } = await setup();

    // First session
    const in1 = await staff.post('/api/v1/attendance/check-in', {});
    expect(in1.status).toBe(201);
    const out1 = await staff.post('/api/v1/attendance/check-out', {});
    expect(out1.status).toBe(200);

    // Second session
    const in2 = await staff.post('/api/v1/attendance/check-in', {});
    expect(in2.status).toBe(201);
    expect(in2.body.data.id).not.toBe(in1.body.data.id);

    // Today summary shows 2 sessions
    const today = await staff.get('/api/v1/attendance/today');
    expect(today.status).toBe(200);
    expect(today.body.data.sessionsCount).toBe(2);
    expect(today.body.data.activeSession.id).toBe(in2.body.data.id);
  });
});
