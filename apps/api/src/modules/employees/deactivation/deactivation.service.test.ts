import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { AuditError } from '../../../platform/audit/types';
import { MemoryDeactivationRepository, MemoryPerson } from './deactivation.repository.memory';
import { EmployeeDeactivationService } from './deactivation.service';

const person = (n: number, overrides: Partial<MemoryPerson> = {}): MemoryPerson => ({
  employeeId: `e-${n}`,
  status: 'active',
  userId: `u-${n}`,
  userActive: true,
  holdsAdminRole: false,
  managerId: null,
  employeeCode: `EMP-${n}`,
  name: `Person ${n}`,
  version: 1,
  deactivatedAt: null,
  ...overrides,
});

const caller = { actorId: 'u-actor', employeeId: 'e-actor', requestId: 'req-1' };

function build(people: MemoryPerson[], options: { revokeFails?: boolean } = {}) {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryDeactivationRepository(people);
  const revoked: string[] = [];
  const sessions = {
    async revokeAllForUser(userId: string) {
      revoked.push(userId);
      if (options.revokeFails) throw new Error('redis down');
      return 3;
    },
  };
  const service = new EmployeeDeactivationService(repo, platform, sessions, silent);
  const events: unknown[] = [];
  platform.events.subscribe('employee.deactivated', (e) => {
    events.push(e.payload);
  });
  return { service, repo, auditStore, revoked, events };
}

describe('EmployeeDeactivationService.deactivate', () => {
  it('switches off the employee and the account, ends the sessions, audits and announces', async () => {
    const ctx = build([
      person(1),
      person(2, { managerId: 'e-1' }),
      person(3, { managerId: 'e-1', status: 'deactivated' }),
    ]);
    const result = await ctx.service.deactivate('e-1', caller);

    expect(result).toMatchObject({
      id: 'e-1',
      status: 'deactivated',
      alreadyDeactivated: false,
      sessionsRevoked: 3,
      version: 2,
    });
    // Only people who still need a new manager.
    expect(result.directReports).toEqual([{ id: 'e-2', employeeCode: 'EMP-2', name: 'Person 2' }]);
    expect(ctx.repo.people[0]).toMatchObject({ status: 'deactivated', userActive: false });
    expect(ctx.revoked).toEqual(['u-1']);
    expect(ctx.events).toEqual([{ employeeId: 'e-1', userId: 'u-1', directReportIds: ['e-2'] }]);

    const [entry, ...rest] = ctx.auditStore.find((e) => e.action === 'employee.deactivate');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: 'e-1',
      actorId: 'u-actor',
      changes: { status: { from: 'active', to: 'deactivated' } },
      metadata: { directReports: 1 },
    });
    expect(ctx.auditStore.find((e) => e.action === 'session.revoke_all')).toMatchObject([
      { outcome: 'success', metadata: { reason: 'deactivation', sessions: 3 } },
    ]);
  });

  it('is idempotent: a repeat changes and audits nothing, announces nothing, and ends sessions again', async () => {
    const ctx = build([person(1)]);
    await ctx.service.deactivate('e-1', caller);
    const again = await ctx.service.deactivate('e-1', caller);
    expect(again).toMatchObject({ alreadyDeactivated: true, status: 'deactivated', version: 2 });
    expect(ctx.auditStore.find((e) => e.action === 'employee.deactivate')).toHaveLength(1);
    expect(ctx.events).toHaveLength(1);
    expect(ctx.revoked).toEqual(['u-1', 'u-1']);
  });

  it('deactivates an employee who was never activated', async () => {
    const ctx = build([person(1, { status: 'pending', userActive: false })]);
    const result = await ctx.service.deactivate('e-1', caller);
    expect(result.alreadyDeactivated).toBe(false);
    expect(
      ctx.auditStore.find((e) => e.action === 'employee.deactivate')[0]?.changes,
    ).toMatchObject({
      status: { from: 'pending', to: 'deactivated' },
    });
  });

  it('deactivates an employee without an account and does not call the session service', async () => {
    const ctx = build([person(1, { userId: null, userActive: false })]);
    const result = await ctx.service.deactivate('e-1', caller);
    expect(result).toMatchObject({ alreadyDeactivated: false, sessionsRevoked: 0 });
    expect(ctx.revoked).toHaveLength(0);
  });

  it('refuses to deactivate yourself and touches nothing', async () => {
    const ctx = build([person(1, { employeeId: 'e-actor', holdsAdminRole: true })]);
    await expect(ctx.service.deactivate('e-actor', caller)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(ctx.repo.people[0]?.status).toBe('active');
    expect(ctx.revoked).toHaveLength(0);
  });

  it('answers 404 for an unknown employee', async () => {
    const ctx = build([person(1)]);
    await expect(ctx.service.deactivate('nobody', caller)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  describe('the last active Admin', () => {
    it('cannot be deactivated, and nothing changes', async () => {
      const ctx = build([person(1, { holdsAdminRole: true })]);
      await expect(ctx.service.deactivate('e-1', caller)).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining('last active Admin'),
      });
      expect(ctx.repo.people[0]?.status).toBe('active');
      expect(ctx.revoked).toHaveLength(0);
      expect(ctx.auditStore.find((e) => e.action === 'employee.deactivate')).toMatchObject([
        { outcome: 'failure' },
      ]);
    });

    it('can be deactivated while another active Admin remains', async () => {
      const ctx = build([person(1, { holdsAdminRole: true }), person(2, { holdsAdminRole: true })]);
      expect((await ctx.service.deactivate('e-1', caller)).alreadyDeactivated).toBe(false);
    });

    it.each([
      ['an inactive account', { userActive: false }],
      ['a deactivated employee', { status: 'deactivated' as const }],
    ])('does not count %s as another Admin', async (_name, other) => {
      const ctx = build([
        person(1, { holdsAdminRole: true }),
        person(2, { holdsAdminRole: true, ...other }),
      ]);
      await expect(ctx.service.deactivate('e-1', caller)).rejects.toMatchObject({
        statusCode: 422,
      });
    });

    it('does not block deactivating an Admin who is already inactive', async () => {
      const ctx = build([person(1, { holdsAdminRole: true, userActive: false })]);
      expect((await ctx.service.deactivate('e-1', caller)).alreadyDeactivated).toBe(false);
    });
  });

  it('keeps the deactivation when ending the sessions fails, and a repeat retries it', async () => {
    const ctx = build([person(1)], { revokeFails: true });
    const result = await ctx.service.deactivate('e-1', caller);
    expect(result).toMatchObject({ status: 'deactivated', sessionsRevoked: 0 });
    expect(ctx.repo.people[0]?.status).toBe('deactivated');
    await ctx.service.deactivate('e-1', caller);
    expect(ctx.revoked).toEqual(['u-1', 'u-1']);
  });

  it('a failure while writing leaves everything as it was: no event, no session end', async () => {
    const ctx = build([person(1)]);
    ctx.repo.failAfterDeactivate = new Error('write failed');
    await expect(ctx.service.deactivate('e-1', caller)).rejects.toThrow('write failed');
    expect(ctx.repo.people[0]).toMatchObject({ status: 'active', userActive: true, version: 1 });
    expect(ctx.events).toHaveLength(0);
    expect(ctx.revoked).toHaveLength(0);
  });

  it('an audit failure undoes the deactivation (fail closed)', async () => {
    const ctx = build([person(1)]);
    ctx.auditStore.failNextWith(new AuditError('audit store down'));
    await expect(ctx.service.deactivate('e-1', caller)).rejects.toThrow();
    expect(ctx.repo.people[0]?.status).toBe('active');
    expect(ctx.revoked).toHaveLength(0);
  });
});
