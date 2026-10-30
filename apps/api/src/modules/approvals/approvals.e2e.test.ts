import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';
import { TEST_PASSWORD } from '../auth/auth.testing';

let keyCounter = 0;
const nextKey = () => `appr-key-${++keyCounter}-${Date.now()}`;

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

describe('TC-37: Approvals Engine Module E2E', () => {
  const leaveSubjectId = crypto.randomUUID();

  it('TC-37-01: creates approval request and successfully approves with comment', async () => {
    const { app, authKit } = makeApp();
    const staffSession = await signIn(app, 'staff@maxr.test');
    const leadSession = await signIn(app, 'team_lead@maxr.test');
    const staffEmployeeId = authKit.users.staff.employeeId;
    const leadEmployeeId = authKit.users.team_lead.employeeId;

    // 1. Create approval request
    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Cookie', staffSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', staffSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'LEAVE',
        subjectId: leaveSubjectId,
        requesterId: staffEmployeeId,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toMatchObject({
      subjectType: 'LEAVE',
      subjectId: leaveSubjectId,
      requesterId: staffEmployeeId,
      status: 'PENDING',
      approverId: null,
    });
    const approvalId = createRes.body.data.id;

    // 2. Query list
    const listRes = await request(app)
      .get('/api/v1/approvals?status=PENDING')
      .set('Cookie', leadSession.cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((a: { id: string }) => a.id === approvalId)).toBe(true);

    // 3. Approve as approver
    const approveRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ comment: 'Approved for annual leave' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data).toMatchObject({
      id: approvalId,
      status: 'APPROVED',
      approverId: leadEmployeeId,
      comment: 'Approved for annual leave',
    });
    expect(approveRes.body.data.decidedAt).not.toBeNull();
  });

  it('TC-37-02: self-approval is rejected with 422 UNPROCESSABLE_ENTITY (AGENTS.md §9)', async () => {
    const { app, authKit } = makeApp();
    const leadSession = await signIn(app, 'team_lead@maxr.test');
    const leadEmployeeId = authKit.users.team_lead.employeeId;

    // Team lead creates an approval request (they hold approvals.create)
    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'ATTENDANCE_CORRECTION',
        subjectId: leaveSubjectId,
        requesterId: leadEmployeeId,
      });

    const approvalId = createRes.body.data.id;

    // Team lead attempts to approve own request (holds approvals.decide, but blocked by self-approval rule)
    const selfApproveRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ comment: 'Self approving' });

    expect(selfApproveRes.status).toBe(422);
    expect(selfApproveRes.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(selfApproveRes.body.error.message).toMatch(/self-approval is forbidden/i);
  });

  it('TC-37-03: already decided request cannot be approved again (409 CONFLICT)', async () => {
    const { app, authKit } = makeApp();
    const staffSession = await signIn(app, 'staff@maxr.test');
    const leadSession = await signIn(app, 'team_lead@maxr.test');
    const staffEmployeeId = authKit.users.staff.employeeId;

    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Cookie', staffSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', staffSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'EXPENSE',
        subjectId: leaveSubjectId,
        requesterId: staffEmployeeId,
      });

    const approvalId = createRes.body.data.id;

    // First approve
    await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ comment: 'Initial approval' });

    // Second approve should fail with 409
    const secondApprove = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ comment: 'Duplicate approval attempt' });

    expect(secondApprove.status).toBe(409);
    expect(secondApprove.body.error.code).toBe('CONFLICT');
  });

  it('TC-37-04: rejects request with comment', async () => {
    const { app, authKit } = makeApp();
    const staffSession = await signIn(app, 'staff@maxr.test');
    const leadSession = await signIn(app, 'team_lead@maxr.test');
    const staffEmployeeId = authKit.users.staff.employeeId;
    const leadEmployeeId = authKit.users.team_lead.employeeId;

    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Cookie', staffSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', staffSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'LEAVE',
        subjectId: leaveSubjectId,
        requesterId: staffEmployeeId,
      });

    const approvalId = createRes.body.data.id;

    const rejectRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/reject`)
      .set('Cookie', leadSession.cookie)
      .set('Origin', ORIGIN)
      .set('x-csrf-token', leadSession.csrf)
      .set('Idempotency-Key', nextKey())
      .send({ comment: 'Conflict with team deliverables' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data).toMatchObject({
      id: approvalId,
      status: 'REJECTED',
      approverId: leadEmployeeId,
      comment: 'Conflict with team deliverables',
    });
  });
});
