import { ROLES, type Role } from '@maxr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { AuditError } from '../../platform/audit/types';
import { toScopeFilter } from '../rbac';
import { defaultRoute, denialReason } from './approval-rules';
import { MemoryApprovalsRepository } from './approvals.repository.memory';
import { ApprovalCaller, ApprovalsService } from './approvals.service';
import { Approval, ApprovalHandler, ApprovalOutcome, ApprovalStage } from './approvals.types';

const E = {
  staff: 'e-staff',
  lead: 'e-lead',
  hr: 'e-hr',
  hr2: 'e-hr2',
  admin: 'e-admin',
  other: 'e-other',
};

const caller = (name: keyof typeof E, roles: Role[]): ApprovalCaller => ({
  actorId: `u-${name}`,
  employeeId: E[name],
  roles,
});
const lead = caller('lead', [ROLES.TEAM_LEAD]);
const hr = caller('hr', [ROLES.HR_MANAGER]);
const hr2 = caller('hr2', [ROLES.HR_MANAGER]);
const admin = caller('admin', [ROLES.ADMIN]);
const staff = caller('staff', [ROLES.STAFF]);
const other = caller('other', [ROLES.TEAM_LEAD]);

const ALL = { kind: 'all' } as const;
const teamOf = (c: ApprovalCaller) => toScopeFilter('team', { employeeId: c.employeeId });

function build() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryApprovalsRepository([], {
    [E.staff]: { name: 'Sam Staff', managerId: E.lead, roles: [ROLES.STAFF] },
  });
  const service = new ApprovalsService(repo, platform);
  const applied: Array<{ outcome: ApprovalOutcome; by: string; subjectId: string }> = [];
  const events: string[] = [];
  for (const type of ['approvals.approved', 'approvals.rejected', 'approvals.advanced']) {
    platform.events.subscribe(type, () => {
      events.push(type);
    });
  }
  const handler: ApprovalHandler & { fail?: Error } = {
    subjectType: 'leave_request',
    async apply(_tx, approval, outcome, decider) {
      if (handler.fail) throw handler.fail;
      applied.push({ outcome, by: decider.employeeId, subjectId: approval.subjectId });
    },
  };
  service.registerHandler(handler);
  return { service, repo, auditStore, applied, events, handler };
}

async function submit(
  ctx: ReturnType<typeof build>,
  stages: ApprovalStage[],
  subjectId = '00000000-0000-4000-8000-000000000001',
): Promise<Approval> {
  return ctx.repo.transaction((tx) =>
    ctx.service.submit(tx, {
      subjectType: 'leave_request',
      subjectId,
      requesterEmployeeId: E.staff,
      stages,
    }),
  );
}

describe('defaultRoute (D-12, D-17)', () => {
  it.each([
    [
      'Staff with a manager, one step',
      { managerId: 'm', roles: [ROLES.STAFF] },
      false,
      ['manager'],
    ],
    [
      'Staff with a manager, two steps',
      { managerId: 'm', roles: [ROLES.STAFF] },
      true,
      ['manager', 'hr'],
    ],
    ['Staff without a manager', { managerId: null, roles: [ROLES.STAFF] }, true, ['hr']],
    ['a Team Lead goes to HR only', { managerId: 'm', roles: [ROLES.TEAM_LEAD] }, true, ['hr']],
    ['an HR Manager goes to HR', { managerId: 'm', roles: [ROLES.HR_MANAGER] }, false, ['hr']],
    ['an Admin goes to HR', { managerId: 'm', roles: [ROLES.ADMIN] }, false, ['hr']],
    [
      'a Staff who is also a Team Lead goes to HR only',
      { managerId: 'm', roles: [ROLES.STAFF, ROLES.TEAM_LEAD] },
      false,
      ['hr'],
    ],
  ] as const)('%s', (_name, context, twoStep, expected) => {
    expect(defaultRoute(context, twoStep)).toEqual(expected);
  });
});

describe('who may decide the current step', () => {
  const base: Approval = {
    id: 'a',
    subjectType: 'leave_request',
    subjectId: 's',
    requesterEmployeeId: E.staff,
    requesterName: 'Sam',
    requesterManagerId: E.lead,
    stages: ['manager', 'hr'],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: '2026-10-30T00:00:00.000Z',
    decidedAt: null,
  };

  it.each([
    ['the manager at the manager step', 0, lead, null],
    ['another Team Lead at the manager step', 0, other, 'not_your_stage'],
    ['HR at the manager step', 0, hr, 'not_your_stage'],
    ['HR at the hr step', 1, hr, null],
    ['an Admin at the hr step', 1, admin, null],
    ['the manager at the hr step', 1, lead, 'not_your_stage'],
    ['the requester', 0, staff, 'own_request'],
  ] as const)('%s', (_name, stage, who, expected) => {
    expect(denialReason({ ...base, currentStage: stage }, who)).toBe(expected);
  });

  it('refuses someone who already decided an earlier step (four eyes)', () => {
    const decided = {
      ...base,
      currentStage: 1,
      decisions: [
        {
          stage: 0,
          decidedByEmployeeId: E.hr,
          outcome: 'approved' as const,
          comment: null,
          decidedAt: '2026-10-30T01:00:00.000Z',
        },
      ],
    };
    expect(denialReason(decided, hr)).toBe('already_decided');
    expect(denialReason(decided, hr2)).toBeNull();
  });

  it('refuses everyone once the approval is not pending', () => {
    expect(denialReason({ ...base, status: 'approved' }, lead)).toBe('not_pending');
  });
});

describe('ApprovalsService.decide', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('applies a one-step approval, in the handler, with an audit entry and one event', async () => {
    const a = await submit(ctx, ['manager']);
    const done = await ctx.service.decide(a.id, 'approved', 'ok', lead, teamOf(lead));
    expect(done.status).toBe('approved');
    expect(done.decidedAt).not.toBeNull();
    expect(done.decisions).toMatchObject([
      { stage: 0, decidedByEmployeeId: E.lead, comment: 'ok' },
    ]);
    expect(ctx.applied).toEqual([{ outcome: 'approved', by: E.lead, subjectId: a.subjectId }]);
    expect(ctx.events).toEqual(['approvals.approved']);
    const [entry, ...rest] = ctx.auditStore.find((e) => e.action === 'approvals.approve');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: a.id,
      actorId: lead.actorId,
      changes: { status: { from: 'pending', to: 'approved' }, stage: 0 },
      metadata: { subjectType: 'leave_request', commentProvided: true },
    });
    expect(JSON.stringify(entry)).not.toContain('"ok"');
  });

  it('a two-step route advances without touching the handler until the last step', async () => {
    const a = await submit(ctx, ['manager', 'hr']);
    const mid = await ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead));
    expect(mid).toMatchObject({ status: 'pending', currentStage: 1 });
    expect(ctx.applied).toHaveLength(0);
    expect(ctx.events).toEqual(['approvals.advanced']);

    const end = await ctx.service.decide(a.id, 'approved', undefined, hr, ALL);
    expect(end.status).toBe('approved');
    expect(ctx.applied).toHaveLength(1);
    expect(end.decisions.map((d) => d.stage)).toEqual([0, 1]);
  });

  it('a rejection at the first step ends the route and calls the handler once', async () => {
    const a = await submit(ctx, ['manager', 'hr']);
    const done = await ctx.service.decide(a.id, 'rejected', 'no', lead, teamOf(lead));
    expect(done.status).toBe('rejected');
    expect(ctx.applied).toEqual([{ outcome: 'rejected', by: E.lead, subjectId: a.subjectId }]);
    expect(ctx.events).toEqual(['approvals.rejected']);
  });

  it('the same person cannot decide both steps of a route', async () => {
    const a = await submit(ctx, ['hr', 'hr']);
    await ctx.service.decide(a.id, 'approved', undefined, hr, ALL);
    await expect(ctx.service.decide(a.id, 'approved', undefined, hr, ALL)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect((await ctx.service.get(a.id, ALL)).currentStage).toBe(1);
    await ctx.service.decide(a.id, 'approved', undefined, hr2, ALL);
  });

  it.each([
    ['the requester', staff, 403],
    ['a Team Lead who is not the manager', other, 404],
    ['HR at the manager step', hr, 403],
  ] as const)('%s is refused with %i and nothing is applied', async (_n, who, status) => {
    const a = await submit(ctx, ['manager']);
    const filter = who === other ? teamOf(other) : ALL;
    await expect(
      ctx.service.decide(a.id, 'approved', undefined, who, filter),
    ).rejects.toMatchObject({
      statusCode: status,
    });
    expect(ctx.applied).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
    expect((await ctx.service.get(a.id, ALL)).status).toBe('pending');
  });

  it('deciding your own request is refused even with company-wide scope', async () => {
    const own = caller('staff', [ROLES.HR_MANAGER]);
    const a = await submit(ctx, ['hr']);
    await expect(ctx.service.decide(a.id, 'approved', undefined, own, ALL)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('the requester gets 403 on their own request even after it was decided', async () => {
    const own = caller('staff', [ROLES.HR_MANAGER]);
    const a = await submit(ctx, ['hr']);
    await ctx.service.decide(a.id, 'approved', undefined, admin, ALL);
    await expect(ctx.service.decide(a.id, 'approved', undefined, own, ALL)).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('records a denial as an audit entry with outcome denied', async () => {
    const a = await submit(ctx, ['manager']);
    await expect(ctx.service.decide(a.id, 'approved', undefined, hr, ALL)).rejects.toThrow();
    expect(ctx.auditStore.find((e) => e.action === 'approvals.approve')).toMatchObject([
      { outcome: 'denied', entityId: a.id },
    ]);
  });

  it('answers 404 for an unknown approval', async () => {
    await expect(
      ctx.service.decide('missing', 'approved', undefined, lead, teamOf(lead)),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('repeating the decision that stands is a no-op; the opposite is a conflict', async () => {
    const a = await submit(ctx, ['manager']);
    await ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead));
    const again = await ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead));
    expect(again.status).toBe('approved');
    expect(ctx.applied).toHaveLength(1);
    expect(ctx.auditStore.find((e) => e.outcome === 'success')).toHaveLength(1);
    await expect(
      ctx.service.decide(a.id, 'rejected', 'late', lead, teamOf(lead)),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('a handler failure leaves the approval pending and sends no event', async () => {
    const a = await submit(ctx, ['manager']);
    ctx.handler.fail = new Error('balance update failed');
    await expect(
      ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead)),
    ).rejects.toThrow('balance update failed');
    const after = await ctx.service.get(a.id, ALL);
    expect(after).toMatchObject({ status: 'pending', currentStage: 0, decisions: [] });
    expect(ctx.events).toHaveLength(0);

    ctx.handler.fail = undefined;
    expect((await ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead))).status).toBe(
      'approved',
    );
  });

  it('an audit failure undoes the decision (fail closed)', async () => {
    const a = await submit(ctx, ['manager']);
    ctx.auditStore.failNextWith(new AuditError('audit store down'));
    await expect(
      ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead)),
    ).rejects.toThrow();
    expect((await ctx.service.get(a.id, ALL)).status).toBe('pending');
    expect(ctx.events).toHaveLength(0);
  });
});

describe('ApprovalsService.submit and cancel', () => {
  it('refuses a subject type nobody registered', async () => {
    const ctx = build();
    await expect(
      ctx.repo.transaction((tx) =>
        ctx.service.submit(tx, {
          subjectType: 'unknown_thing',
          subjectId: '00000000-0000-4000-8000-000000000009',
          requesterEmployeeId: E.staff,
          stages: ['hr'],
        }),
      ),
    ).rejects.toThrow(/No approval handler/);
  });

  it('refuses a second handler for the same subject type', () => {
    const ctx = build();
    expect(() =>
      ctx.service.registerHandler({ subjectType: 'leave_request', apply: async () => {} }),
    ).toThrow(/already registered/);
  });

  it('routes a requester through the repository context', async () => {
    const ctx = build();
    const stages = await ctx.repo.transaction((tx) =>
      ctx.service.route(tx, E.staff, { twoStep: true }),
    );
    expect(stages).toEqual(['manager', 'hr']);
  });

  it('cancels a pending approval, ignores a subject without one, and cannot cancel a decided one', async () => {
    const ctx = build();
    const a = await submit(ctx, ['manager']);
    const cancelled = await ctx.repo.transaction((tx) =>
      ctx.service.cancel(tx, 'leave_request', a.subjectId),
    );
    expect(cancelled?.status).toBe('cancelled');
    await expect(
      ctx.service.decide(a.id, 'approved', undefined, lead, teamOf(lead)),
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(
      await ctx.repo.transaction((tx) => ctx.service.cancel(tx, 'leave_request', 'no-such')),
    ).toBeNull();

    const b = await submit(ctx, ['manager'], '00000000-0000-4000-8000-000000000002');
    await ctx.service.decide(b.id, 'approved', undefined, lead, teamOf(lead));
    await expect(
      ctx.repo.transaction((tx) => ctx.service.cancel(tx, 'leave_request', b.subjectId)),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('ApprovalsService.list', () => {
  it('awaitingMyDecision lists only what is waiting for the caller, oldest first', async () => {
    const ctx = build();
    await submit(ctx, ['manager'], '00000000-0000-4000-8000-000000000001');
    await submit(ctx, ['hr'], '00000000-0000-4000-8000-000000000002');
    const q = { page: 1, pageSize: 20, awaitingMyDecision: true };
    const forLead = await ctx.service.list(q, lead, teamOf(lead));
    expect(forLead.data.map((a) => a.stages[0])).toEqual(['manager']);
    const forHr = await ctx.service.list(q, hr, ALL);
    expect(forHr.data.map((a) => a.stages[0])).toEqual(['hr']);
    const forOther = await ctx.service.list(q, other, teamOf(other));
    expect(forOther.meta.total).toBe(0);
  });
});
