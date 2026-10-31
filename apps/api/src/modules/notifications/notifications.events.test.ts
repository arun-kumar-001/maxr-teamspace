import { ROLES, type Role } from '@maxr/shared';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { InMemoryIdempotencyStore } from '../../http/idempotency';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createApprovals } from '../approvals';
import { MemoryApprovalsRepository } from '../approvals/approvals.repository.memory';
import { createTestAuth } from '../auth/auth.testing';
import { MemoryHolidaysRepository } from '../leave/holidays/holidays.repository.memory';
import { createLeaveSetup } from '../leave';
import { MemoryLeavePoliciesRepository } from '../leave/policies/policies.repository.memory';
import { MemoryLeaveRequestsRepository } from '../leave/requests/requests.repository.memory';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { createNotifications } from './index';
import { createNotificationJobs } from './notifications.jobs';
import { MemoryNotificationsRepository } from './notifications.repository.memory';

const ANNUAL = '71000000-0000-4000-8000-000000000001';
const APP_URL = 'https://teamspace.example.test';

async function setup(options: { appUrl?: string } = {}) {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, outbox } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const id = (role: Role) => kit.users[role].employeeId;

  const approvalsRepo = new MemoryApprovalsRepository();
  const approvals = createApprovals({
    platform,
    authenticate: kit.auth.authenticate,
    repository: approvalsRepo,
  });
  approvalsRepo.requesters[id('staff')] = {
    name: 'Sam Staff',
    managerId: id('team_lead'),
    roles: [ROLES.STAFF],
  };
  for (const role of ['team_lead', 'hr_manager', 'admin'] as Role[]) {
    approvalsRepo.requesters[id(role)] = { name: role, managerId: null, roles: [role] };
  }

  const requestsRepo = new MemoryLeaveRequestsRepository((e) =>
    e === id('staff') ? id('team_lead') : null,
  );
  for (const role of ALL_ROLES) {
    requestsRepo.balances.push({
      employeeId: id(role),
      leaveTypeId: ANNUAL,
      year: 2026,
      allotted: 18,
      carriedForward: 0,
      used: 0,
    });
  }
  const leave = createLeaveSetup({
    platform,
    approvals: approvals.service,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    settings: {
      getBasic: async () => ({
        companyName: 'T',
        timezone: 'Asia/Kolkata',
        workWeek: {
          start: 'Monday',
          end: 'Friday',
          days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
      }),
    },
    policiesRepository: new MemoryLeavePoliciesRepository([
      {
        id: ANNUAL,
        code: 'ANNUAL',
        name: 'Annual leave',
        hasBalance: true,
        isActive: true,
        annualDays: 18,
        carryForwardMax: 0,
        allowHalfDay: true,
        maxBackdateDays: 0,
        version: 1,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]),
    holidaysRepository: new MemoryHolidaysRepository(),
    requestsRepository: requestsRepo,
    clock: () => new Date('2026-10-31T10:00:00Z'),
  });

  const notifRepo = new MemoryNotificationsRepository();
  for (const role of ALL_ROLES) {
    notifRepo.employees[id(role)] = {
      email: `${role}@maxr.internal`,
      managerId: role === 'staff' ? id('team_lead') : null,
      isHrApprover: role === 'hr_manager' || role === 'admin',
      active: true,
    };
  }
  const notifications = createNotifications({
    platform,
    authenticate: kit.auth.authenticate,
    idempotencyStore: new InMemoryIdempotencyStore(),
    repository: notifRepo,
    appUrl: options.appUrl,
  });

  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/leave-requests', leave.requestsRouter);
  app.use('/api/v1/approvals', approvals.router);
  app.use('/api/v1/notifications', notifications.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);

  let n = 0;
  const apply = (who: Role, startDate = '2026-11-02', endDate = '2026-11-03') =>
    as[who]
      .post('/api/v1/leave-requests', {
        leaveTypeId: ANNUAL,
        startDate,
        endDate,
        reason: 'A private reason',
      })
      .set('Idempotency-Key', `n-${who}-${++n}-abcdefgh`);
  const inbox = async (who: Role) => (await as[who].get('/api/v1/notifications')).body;
  const emails = () => outbox.claimDue(100, new Date(Date.now() + 60_000), 60_000);
  const approvalOf = async (who: Role) =>
    (await as[who].get('/api/v1/approvals?awaitingMyDecision=true')).body.data[0].id as string;
  return {
    as,
    kit,
    id,
    approvals,
    approvalsRepo,
    notifRepo,
    notifications,
    apply,
    inbox,
    emails,
    approvalOf,
    platform,
  };
}

describe('notifications from events', () => {
  it('tells the requester’s manager, and only the manager, that a request waits', async () => {
    const { apply, inbox, emails } = await setup({ appUrl: APP_URL });
    await apply('staff');
    const lead = await inbox('team_lead');
    expect(lead.data).toHaveLength(1);
    expect(lead.data[0]).toMatchObject({
      type: 'approval.requested',
      title: 'Leave request waiting for your decision',
      readAt: null,
    });
    expect(lead.data[0].link).toMatch(/^\/approvals\/[0-9a-f-]{36}$/);
    expect(lead.meta.unread).toBe(1);
    for (const other of ['staff', 'hr_manager', 'admin'] as Role[]) {
      expect((await inbox(other)).data, other).toHaveLength(0);
    }
    const queued = await emails();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload.to).toEqual(['team_lead@maxr.internal']);
  });

  it('emails carry no sensitive data: no reason, dates, days or names', async () => {
    const { apply, emails } = await setup({ appUrl: APP_URL });
    await apply('staff', '2026-11-02', '2026-11-03');
    const [email] = await emails();
    const text = `${email?.payload.subject}\n${email?.payload.text}`;
    expect(text).toContain(APP_URL);
    expect(text).not.toMatch(/private reason|2026-11|Sam|Staff|days?\b.*\d|annual/i);
    expect(email?.payload.subject).toBe('Leave request waiting for your decision');
  });

  it('leaves out the link when the app URL is not configured', async () => {
    const { apply, emails } = await setup();
    await apply('staff');
    const [email] = await emails();
    expect(email?.payload.text).toContain('Open MAXR Teamspace to see it.');
    expect(email?.payload.text).not.toContain('http');
  });

  it('tells the requester when the request is approved or rejected', async () => {
    const { as, apply, inbox, approvalOf, emails } = await setup();
    await apply('staff', '2026-11-02', '2026-11-03');
    await as.team_lead.post(`/api/v1/approvals/${await approvalOf('team_lead')}/approve`);
    await apply('staff', '2026-11-09', '2026-11-10');
    await as.team_lead.post(`/api/v1/approvals/${await approvalOf('team_lead')}/reject`, {
      comment: 'A secret reason for saying no',
    });
    const staff = await inbox('staff');
    expect(staff.data.map((n: { title: string }) => n.title).sort()).toEqual([
      'Leave request approved',
      'Leave request rejected',
    ]);
    const all = JSON.stringify(await emails());
    expect(all).not.toContain('secret reason');
  });

  it('tells HR when a two-step request moves on to them, and not before', async () => {
    const { as, id, approvals, approvalsRepo, inbox } = await setup();
    // Leave has one step; expense claims (D-17) will have two. Submit one the way a module would.
    const approval = await approvalsRepo.transaction((tx) =>
      approvals.service.submit(tx, {
        subjectType: 'leave_request',
        subjectId: '86000000-0000-4000-8000-000000000001',
        requesterEmployeeId: id('staff'),
        stages: ['manager', 'hr'],
      }),
    );
    expect((await inbox('hr_manager')).data).toHaveLength(0);
    await as.team_lead.post(`/api/v1/approvals/${approval.id}/approve`);
    for (const who of ['hr_manager', 'admin'] as Role[]) {
      const notices = (await inbox(who)).data;
      expect(notices, who).toHaveLength(1);
      expect(notices[0]).toMatchObject({
        type: 'approval.advanced',
        title: 'Leave request waiting for your decision',
      });
    }
    expect((await inbox('staff')).data).toHaveLength(0);
  });

  it('sends HR requests to HR and Admin but never to the requester', async () => {
    const { apply, inbox } = await setup();
    await apply('hr_manager');
    expect((await inbox('admin')).data).toHaveLength(1);
    expect((await inbox('hr_manager')).data).toHaveLength(0);
    expect((await inbox('team_lead')).data).toHaveLength(0);
  });

  it('tells the owner when HR cancels approved leave, but not when the owner cancels their own', async () => {
    const { as, apply, inbox, approvalOf } = await setup();
    const first = await apply('staff', '2026-11-02', '2026-11-03');
    await as.team_lead.post(`/api/v1/approvals/${await approvalOf('team_lead')}/approve`);
    await as.staff.post(`/api/v1/leave-requests/${first.body.data.id}/cancel`);
    const own = (await inbox('staff')).data.filter(
      (n: { type: string }) => n.type === 'leave.cancelled',
    );
    expect(own).toHaveLength(0);

    const second = await apply('staff', '2026-11-09', '2026-11-10');
    await as.team_lead.post(`/api/v1/approvals/${await approvalOf('team_lead')}/approve`);
    await as.hr_manager.post(`/api/v1/leave-requests/${second.body.data.id}/cancel`);
    const notices = (await inbox('staff')).data.filter(
      (n: { type: string }) => n.type === 'leave.cancelled',
    );
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toBe('Your approved leave was cancelled by HR');
  });

  it('sends nothing for a request that failed', async () => {
    const { apply, inbox, emails } = await setup();
    expect((await apply('staff', '2026-11-03', '2026-11-02')).status).toBe(400);
    expect((await inbox('team_lead')).data).toHaveLength(0);
    expect(await emails()).toHaveLength(0);
  });

  it('a manager who is no longer active receives nothing', async () => {
    const { apply, notifRepo, emails } = await setup();
    const manager = Object.values(notifRepo.employees).find(
      (e) => e.email === 'team_lead@maxr.internal',
    );
    if (manager) manager.active = false;
    await apply('staff');
    expect(notifRepo.rows).toHaveLength(0);
    expect(await emails()).toHaveLength(0);
  });

  it('a mail queue that is down does not lose the in-app notification or fail the request', async () => {
    const { apply, inbox, platform } = await setup();
    platform.notifications.enqueueEmail = async () => {
      throw new Error('outbox down');
    };
    expect((await apply('staff')).status).toBe(201);
    expect((await inbox('team_lead')).data).toHaveLength(1);
  });
});

describe('reminders and retention', () => {
  const NOW = new Date('2026-11-05T10:00:00Z');
  const A1 = '81000000-0000-4000-8000-000000000001';

  it('reminds the current approver once per approval step, however often the job runs', async () => {
    const { notifications, notifRepo, id, inbox, emails } = await setup({ appUrl: APP_URL });
    const stale = (stage: 'manager' | 'hr') => [
      { approvalId: A1, subjectType: 'leave_request', requesterEmployeeId: id('staff'), stage },
    ];
    notifRepo.stale = stale('manager');
    expect(await notifications.service.sendApprovalReminders(NOW)).toBe(1);
    expect(await notifications.service.sendApprovalReminders(NOW)).toBe(0);
    const lead = (await inbox('team_lead')).data;
    expect(lead).toHaveLength(1);
    expect(lead[0]).toMatchObject({
      type: 'approval.reminder',
      title: 'Leave request still waiting for your decision',
      link: `/approvals/${A1}`,
    });
    expect(await emails()).toHaveLength(1);

    // The same approval moves on to HR: that step is reminded in its turn, HR and Admin both.
    notifRepo.stale = stale('hr');
    expect(await notifications.service.sendApprovalReminders(NOW)).toBe(2);
    expect(await notifications.service.sendApprovalReminders(NOW)).toBe(0);
    expect((await inbox('hr_manager')).data).toHaveLength(1);
    expect((await inbox('admin')).data).toHaveLength(1);
    expect((await inbox('staff')).data).toHaveLength(0);
  });

  it('asks for approvals that have waited more than 24 hours, no less', async () => {
    const { notifications, notifRepo } = await setup();
    await notifications.service.sendApprovalReminders(NOW);
    expect(notifRepo.staleCutoffs).toEqual([new Date('2026-11-04T10:00:00Z')]);
  });

  it('runs the reminder and retention jobs with the time it is given', async () => {
    const { notifications, notifRepo, id } = await setup();
    const jobs = createNotificationJobs(notifications.service);
    expect(jobs.map((job) => job.name)).toEqual([
      'notification-reminders',
      'notification-retention',
    ]);
    notifRepo.stale = [
      {
        approvalId: A1,
        subjectType: 'leave_request',
        requesterEmployeeId: id('staff'),
        stage: 'manager',
      },
    ];
    await jobs[0]?.run(NOW);
    expect(notifRepo.rows).toHaveLength(1);
    const made = await notifRepo.insert({
      recipientEmployeeId: id('staff'),
      type: 'announcement',
      title: 't',
      body: 'b',
      link: null,
      dedupeKey: null,
    });
    notifRepo.now = () => new Date('2026-07-01T00:00:00Z');
    await notifRepo.markRead(made?.id ?? '', id('staff'));
    await jobs[1]?.run(NOW);
    expect(notifRepo.rows.map((r) => r.id)).not.toContain(made?.id);
  });

  it('never reminds a requester about their own request', async () => {
    const { notifications, notifRepo, id, inbox } = await setup();
    notifRepo.stale = [
      {
        approvalId: A1,
        subjectType: 'leave_request',
        requesterEmployeeId: id('hr_manager'),
        stage: 'hr',
      },
    ];
    expect(await notifications.service.sendApprovalReminders(NOW)).toBe(1);
    expect((await inbox('hr_manager')).data).toHaveLength(0);
    expect((await inbox('admin')).data).toHaveLength(1);
  });

  it('removes notifications read more than 90 days ago, and keeps unread and recent ones', async () => {
    const { notifications, notifRepo, id } = await setup();
    const make = (key: string) =>
      notifRepo.insert({
        recipientEmployeeId: id('staff'),
        type: 'approval.approved',
        title: 'Leave request approved',
        body: 'x',
        link: null,
        dedupeKey: key,
      });
    const oldRead = await make('a');
    const recentRead = await make('b');
    const oldUnread = await make('c');
    notifRepo.now = () => new Date('2026-08-01T00:00:00Z'); // 96 days before NOW
    await notifRepo.markRead(oldRead?.id ?? '', id('staff'));
    notifRepo.now = () => new Date('2026-09-01T00:00:00Z');
    await notifRepo.markRead(recentRead?.id ?? '', id('staff'));
    expect(await notifications.service.purgeRead(NOW)).toBe(1);
    expect(notifRepo.rows.map((r) => r.id).sort()).toEqual([recentRead?.id, oldUnread?.id].sort());
  });
});
