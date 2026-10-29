import crypto from 'node:crypto';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeApp } from '../../test/helpers';

let keyCounter = 0;
const nextKey = () => `appr-key-${++keyCounter}-${Date.now()}`;

describe('TC-37: Approvals Engine Module E2E', () => {
  const requesterId = crypto.randomUUID();
  const approverId = crypto.randomUUID();
  const leaveSubjectId = crypto.randomUUID();

  it('TC-37-01: creates approval request and successfully approves with comment', async () => {
    const { app } = makeApp();

    // 1. Create approval request
    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'LEAVE',
        subjectId: leaveSubjectId,
        requesterId,
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data).toMatchObject({
      subjectType: 'LEAVE',
      subjectId: leaveSubjectId,
      requesterId,
      status: 'PENDING',
      approverId: null,
    });
    const approvalId = createRes.body.data.id;

    // 2. Query list
    const listRes = await request(app).get('/api/v1/approvals?status=PENDING');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((a: { id: string }) => a.id === approvalId)).toBe(true);

    // 3. Approve as approver
    const approveRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Idempotency-Key', nextKey())
      .set('x-approver-id', approverId)
      .send({ comment: 'Approved for annual leave' });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data).toMatchObject({
      id: approvalId,
      status: 'APPROVED',
      approverId,
      comment: 'Approved for annual leave',
    });
    expect(approveRes.body.data.decidedAt).not.toBeNull();
  });

  it('TC-37-02: self-approval is rejected with 422 UNPROCESSABLE_ENTITY (AGENTS.md §9)', async () => {
    const { app } = makeApp();

    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'ATTENDANCE_CORRECTION',
        subjectId: leaveSubjectId,
        requesterId,
      });

    const approvalId = createRes.body.data.id;

    // Attempt to approve own request
    const selfApproveRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Idempotency-Key', nextKey())
      .set('x-approver-id', requesterId)
      .send({ comment: 'Self approving' });

    expect(selfApproveRes.status).toBe(422);
    expect(selfApproveRes.body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(selfApproveRes.body.error.message).toMatch(/self-approval is forbidden/i);
  });

  it('TC-37-03: already decided request cannot be approved again (409 CONFLICT)', async () => {
    const { app } = makeApp();

    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'EXPENSE',
        subjectId: leaveSubjectId,
        requesterId,
      });

    const approvalId = createRes.body.data.id;

    // First approve
    await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Idempotency-Key', nextKey())
      .set('x-approver-id', approverId)
      .send();

    // Second approve attempt
    const secondApprove = await request(app)
      .post(`/api/v1/approvals/${approvalId}/approve`)
      .set('Idempotency-Key', nextKey())
      .set('x-approver-id', approverId)
      .send();

    expect(secondApprove.status).toBe(409);
    expect(secondApprove.body.error.code).toBe('CONFLICT');
  });

  it('TC-37-04: rejects request with comment', async () => {
    const { app } = makeApp();

    const createRes = await request(app)
      .post('/api/v1/approvals')
      .set('Idempotency-Key', nextKey())
      .send({
        subjectType: 'LEAVE',
        subjectId: leaveSubjectId,
        requesterId,
      });

    const approvalId = createRes.body.data.id;

    const rejectRes = await request(app)
      .post(`/api/v1/approvals/${approvalId}/reject`)
      .set('Idempotency-Key', nextKey())
      .set('x-approver-id', approverId)
      .send({ comment: 'Insufficient notice' });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data).toMatchObject({
      id: approvalId,
      status: 'REJECTED',
      approverId,
      comment: 'Insufficient notice',
    });
  });
});
