import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { AuditError } from '../../../platform/audit/types';
import { ScopeFilter } from '../../rbac';
import { MemoryHierarchyRepository, MemoryNode } from './hierarchy.repository.memory';
import { HierarchyService } from './hierarchy.service';

const node = (id: string, overrides: Partial<MemoryNode> = {}): MemoryNode => ({
  id,
  employeeCode: `EMP-${id}`,
  name: `Person ${id}`,
  designation: 'Engineer',
  status: 'active',
  version: 1,
  managerId: null,
  ...overrides,
});

const caller = { actorId: 'u-actor', employeeId: 'e-actor', requestId: 'req-1' };
const ALL: ScopeFilter = { kind: 'all' };

/** ceo <- vp <- lead <- dev, and a separate person `solo`. */
function build() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryHierarchyRepository([
    node('ceo'),
    node('vp', { managerId: 'ceo' }),
    node('lead', { managerId: 'vp' }),
    node('dev', { managerId: 'lead' }),
    node('solo'),
  ]);
  const service = new HierarchyService(repo, platform);
  const events: unknown[] = [];
  platform.events.subscribe('employee.manager_changed', (e) => {
    events.push(e.payload);
  });
  return { service, repo, auditStore, events };
}

const manager = (ctx: ReturnType<typeof build>, id: string) =>
  ctx.repo.nodes.find((n) => n.id === id)?.managerId;

describe('HierarchyService.changeManager', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('assigns a manager, bumps the version, audits ids only and announces it', async () => {
    const change = await ctx.service.changeManager(
      'solo',
      { version: 1, managerId: 'lead' },
      caller,
      ALL,
    );
    expect(change).toMatchObject({
      id: 'solo',
      managerId: 'lead',
      manager: { id: 'lead', employeeCode: 'EMP-lead' },
      version: 2,
    });
    const [entry, ...rest] = ctx.auditStore.find((e) => e.action === 'employee.manager_change');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: 'solo',
      actorId: 'u-actor',
      changes: { managerId: { from: null, to: 'lead' } },
    });
    expect(JSON.stringify(entry)).not.toContain('Person');
    expect(ctx.events).toEqual([{ employeeId: 'solo', from: null, to: 'lead' }]);
    expect(ctx.repo.locked).toBe(1);
  });

  it('changes a manager to someone on another branch', async () => {
    await ctx.service.changeManager('dev', { version: 1, managerId: 'ceo' }, caller, ALL);
    expect(manager(ctx, 'dev')).toBe('ceo');
  });

  it('removes a manager with null', async () => {
    const change = await ctx.service.changeManager(
      'dev',
      { version: 1, managerId: null },
      caller,
      ALL,
    );
    expect(change).toMatchObject({ managerId: null, manager: null });
  });

  it('writes nothing when the manager is already this one', async () => {
    const same = await ctx.service.changeManager(
      'dev',
      { version: 1, managerId: 'lead' },
      caller,
      ALL,
    );
    expect(same.version).toBe(1);
    expect(ctx.auditStore.find((e) => e.action === 'employee.manager_change')).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
  });

  describe('loops', () => {
    it('refuses to make someone their own manager', async () => {
      await expect(
        ctx.service.changeManager('solo', { version: 1, managerId: 'solo' }, caller, ALL),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(manager(ctx, 'solo')).toBeNull();
    });

    it('refuses a manager who reports directly to the employee', async () => {
      await expect(
        ctx.service.changeManager('vp', { version: 1, managerId: 'lead' }, caller, ALL),
      ).rejects.toMatchObject({ statusCode: 422, message: expect.stringContaining('loop') });
      expect(manager(ctx, 'vp')).toBe('ceo');
    });

    it('refuses a manager who reports to the employee through several levels', async () => {
      await expect(
        ctx.service.changeManager('ceo', { version: 1, managerId: 'dev' }, caller, ALL),
      ).rejects.toMatchObject({ statusCode: 422 });
      expect(manager(ctx, 'ceo')).toBeNull();
    });

    it('allows a move that only looks like a loop: a manager on a different branch', async () => {
      await ctx.service.changeManager('lead', { version: 1, managerId: 'solo' }, caller, ALL);
      expect(manager(ctx, 'lead')).toBe('solo');
    });

    it('ends the walk even when the data already holds a loop elsewhere', async () => {
      ctx.repo.nodes.find((n) => n.id === 'ceo')!.managerId = 'dev';
      await expect(
        ctx.service.changeManager('solo', { version: 1, managerId: 'vp' }, caller, ALL),
      ).resolves.toBeDefined();
    });
  });

  describe('the manager must be usable', () => {
    it.each([['an unknown manager', 'nobody']])('rejects %s with 422', async (_name, managerId) => {
      await expect(
        ctx.service.changeManager('solo', { version: 1, managerId }, caller, ALL),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it.each(['pending', 'deactivated'] as const)(
      'rejects a %s manager with 422',
      async (status) => {
        ctx.repo.nodes.find((n) => n.id === 'lead')!.status = status;
        const err = await ctx.service
          .changeManager('solo', { version: 1, managerId: 'lead' }, caller, ALL)
          .catch((e) => e);
        expect(err.statusCode).toBe(422);
        expect(err.details?.[0]?.field).toBe('managerId');
        expect(manager(ctx, 'solo')).toBeNull();
      },
    );

    it('refuses to give a deactivated employee a manager', async () => {
      ctx.repo.nodes.find((n) => n.id === 'solo')!.status = 'deactivated';
      await expect(
        ctx.service.changeManager('solo', { version: 1, managerId: 'lead' }, caller, ALL),
      ).rejects.toMatchObject({ statusCode: 422 });
    });
  });

  it('answers 409 for a stale version', async () => {
    await ctx.service.changeManager('solo', { version: 1, managerId: 'lead' }, caller, ALL);
    await expect(
      ctx.service.changeManager('solo', { version: 1, managerId: 'vp' }, caller, ALL),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(manager(ctx, 'solo')).toBe('lead');
  });

  it('answers 404 outside the scope and for an unknown employee, before it checks the version', async () => {
    await expect(
      ctx.service.changeManager('dev', { version: 99, managerId: 'ceo' }, caller, {
        kind: 'team',
        managerId: 'someone-else',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      ctx.service.changeManager('nobody', { version: 1, managerId: 'ceo' }, caller, ALL),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('a failure while writing leaves the tree as it was and audits the failure', async () => {
    ctx.repo.failAfterSet = new Error('write failed');
    await expect(
      ctx.service.changeManager('solo', { version: 1, managerId: 'lead' }, caller, ALL),
    ).rejects.toThrow('write failed');
    expect(manager(ctx, 'solo')).toBeNull();
    expect(ctx.events).toHaveLength(0);
    expect(ctx.auditStore.find((e) => e.action === 'employee.manager_change')).toMatchObject([
      { outcome: 'failure' },
    ]);
  });

  it('an audit failure undoes the change (fail closed)', async () => {
    ctx.auditStore.failNextWith(new AuditError('audit store down'));
    await expect(
      ctx.service.changeManager('solo', { version: 1, managerId: 'lead' }, caller, ALL),
    ).rejects.toThrow();
    expect(manager(ctx, 'solo')).toBeNull();
  });
});

describe('HierarchyService: reading the chart', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });
  const q = { page: 1, pageSize: 50 };

  it('lists the people at the top with how many report to them', async () => {
    const roots = await ctx.service.roots(q, ALL);
    expect(roots.data.map((n) => [n.id, n.directReportCount])).toEqual([
      ['ceo', 1],
      ['solo', 0],
    ]);
    expect(roots.meta).toMatchObject({ total: 2, page: 1 });
  });

  it('leaves deactivated people out of the top unless asked, and out of the counts', async () => {
    ctx.repo.nodes.find((n) => n.id === 'solo')!.status = 'deactivated';
    ctx.repo.nodes.find((n) => n.id === 'vp')!.status = 'deactivated';
    expect((await ctx.service.roots(q, ALL)).data.map((n) => n.id)).toEqual(['ceo']);
    expect((await ctx.service.roots(q, ALL)).data[0]?.directReportCount).toBe(0);
    expect(
      (await ctx.service.roots({ ...q, status: 'deactivated' }, ALL)).data.map((n) => n.id),
    ).toEqual(['solo']);
  });

  it('opens one level at a time', async () => {
    const level = await ctx.service.directReports('vp', q, ALL, caller);
    expect(level.data.map((n) => [n.id, n.directReportCount])).toEqual([['lead', 1]]);
  });

  it('answers 404 for an unknown employee', async () => {
    await expect(ctx.service.directReports('nobody', q, ALL, caller)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it("lets a Team Lead open their own team, and nobody else's", async () => {
    const team: ScopeFilter = { kind: 'team', managerId: 'lead' };
    const lead = { ...caller, employeeId: 'lead' };
    expect((await ctx.service.directReports('lead', q, team, lead)).data.map((n) => n.id)).toEqual([
      'dev',
    ]);
    // `dev` is in their team, so it can be asked about; it has no reports in scope.
    expect((await ctx.service.directReports('dev', q, team, lead)).data).toEqual([]);
    await expect(ctx.service.directReports('vp', q, team, lead)).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('shows a Team Lead no roots', async () => {
    const team: ScopeFilter = { kind: 'team', managerId: 'lead' };
    expect((await ctx.service.roots(q, team)).data).toEqual([]);
  });
});
