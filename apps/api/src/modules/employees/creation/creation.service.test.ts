import { ROLES, type Role } from '@maxr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { AuditError } from '../../../platform/audit/types';
import { testHasher } from '../../auth/auth.testing';
import { MemoryEmployeeCreationRepository } from './creation.repository.memory';
import { EmployeeCreationService } from './creation.service';
import { CreateEmployeeDto } from './creation.types';

const DEPT = '90000000-0000-4000-8000-000000000001';
const DESIG = '90000000-0000-4000-8000-000000000002';
const MANAGER = '90000000-0000-4000-8000-000000000003';

const dto = (overrides: Partial<CreateEmployeeDto> = {}): CreateEmployeeDto => ({
  employeeCode: 'EMP-1001',
  firstName: 'Priya',
  lastName: 'Sharma',
  email: 'priya.sharma@maxr.internal',
  departmentId: DEPT,
  designationId: DESIG,
  joiningDate: '2026-11-02',
  role: ROLES.STAFF,
  ...overrides,
});

const caller = (roles: Role[]) => ({ actorId: 'u-actor', roles, requestId: 'req-1' });
const admin = caller([ROLES.ADMIN]);
const hr = caller([ROLES.HR_MANAGER]);

function build() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore, outbox } = createTestPlatform({ logger: silent });
  const repo = new MemoryEmployeeCreationRepository();
  repo.references.designation = { isActive: true, departmentId: DEPT };
  const service = new EmployeeCreationService(repo, platform, testHasher, silent);
  const events: unknown[] = [];
  platform.events.subscribe('employee.created', (e) => {
    events.push(e.payload);
  });
  return { service, repo, auditStore, outbox, platform, events };
}

describe('EmployeeCreationService.create', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('creates a pending employee with a role, an audit entry, an event and a welcome email', async () => {
    const created = await ctx.service.create(dto({ managerId: MANAGER }), hr);
    expect(created).toMatchObject({
      employeeCode: 'EMP-1001',
      status: 'pending',
      role: ROLES.STAFF,
      managerId: MANAGER,
    });
    expect(JSON.stringify(created)).not.toMatch(/password|hash/i);
    expect(ctx.repo.employees).toHaveLength(1);

    const [entry, ...rest] = ctx.auditStore.find((e) => e.action === 'employee.create');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: created.id,
      actorId: 'u-actor',
      changes: { employeeCode: 'EMP-1001', role: ROLES.STAFF, status: 'pending' },
    });
    // Names and email are personal data: not in the audit trail.
    expect(JSON.stringify(entry)).not.toContain('Priya');
    expect(JSON.stringify(entry)).not.toContain('priya.sharma');

    expect(ctx.events).toEqual([
      { employeeId: created.id, userId: created.userId, role: ROLES.STAFF },
    ]);
    const mail = await ctx.outbox.claimDue(10, new Date(Date.now() + 1000), 1000);
    expect(mail).toHaveLength(1);
    expect(mail[0]?.dedupeKey).toBe(`employee:${created.id}:welcome`);
    expect(mail[0]?.payload.to).toEqual(['priya.sharma@maxr.internal']);
    expect(mail[0]?.payload.text).not.toMatch(/password:|http/i);
  });

  it('stores a real hash of a password nobody knows', async () => {
    await ctx.service.create(dto(), admin);
    const stored = ctx.repo.passwordHashes[0] ?? '';
    expect(stored).toMatch(/^\$argon2id\$/);
    expect(await testHasher.verify(stored, '')).toBe(false);
    await ctx.service.create(
      dto({ employeeCode: 'EMP-1002', email: 'second@maxr.internal' }),
      admin,
    );
    expect(ctx.repo.passwordHashes[1]).not.toBe(stored);
  });

  it.each([ROLES.ADMIN, ROLES.HR_MANAGER])(
    'an HR Manager cannot create a %s account; nothing is stored',
    async (role) => {
      await expect(ctx.service.create(dto({ role }), hr)).rejects.toMatchObject({
        statusCode: 403,
      });
      expect(ctx.repo.employees).toHaveLength(0);
      expect(await ctx.outbox.claimDue(10, new Date(Date.now() + 1000), 1000)).toHaveLength(0);
      expect(ctx.events).toHaveLength(0);
    },
  );

  it.each([ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF])(
    'an Admin can create a %s account',
    async (role) => {
      const created = await ctx.service.create(dto({ role }), admin);
      expect(created.role).toBe(role);
    },
  );

  it('an HR Manager can create Team Lead and Staff accounts', async () => {
    expect((await ctx.service.create(dto({ role: ROLES.TEAM_LEAD }), hr)).role).toBe(
      ROLES.TEAM_LEAD,
    );
  });

  it('a caller who is both Admin and HR Manager may assign any role', async () => {
    const both = caller([ROLES.HR_MANAGER, ROLES.ADMIN]);
    expect((await ctx.service.create(dto({ role: ROLES.ADMIN }), both)).role).toBe(ROLES.ADMIN);
  });

  it.each([
    [
      'a missing department',
      (r: MemoryEmployeeCreationRepository) => (r.references.department = null),
      'departmentId',
    ],
    [
      'an inactive department',
      (r: MemoryEmployeeCreationRepository) => (r.references.department = { isActive: false }),
      'departmentId',
    ],
    [
      'a missing designation',
      (r: MemoryEmployeeCreationRepository) => (r.references.designation = null),
      'designationId',
    ],
    [
      'an inactive designation',
      (r: MemoryEmployeeCreationRepository) =>
        (r.references.designation = { isActive: false, departmentId: DEPT }),
      'designationId',
    ],
    [
      'a designation of another department',
      (r: MemoryEmployeeCreationRepository) =>
        (r.references.designation = { isActive: true, departmentId: 'other' }),
      'designationId',
    ],
    [
      'a missing manager',
      (r: MemoryEmployeeCreationRepository) => (r.references.manager = null),
      'managerId',
    ],
    [
      'a deactivated manager',
      (r: MemoryEmployeeCreationRepository) => (r.references.manager = { status: 'deactivated' }),
      'managerId',
    ],
    [
      'a pending manager',
      (r: MemoryEmployeeCreationRepository) => (r.references.manager = { status: 'pending' }),
      'managerId',
    ],
  ])('rejects %s with 422 naming the field and stores nothing', async (_name, arrange, field) => {
    arrange(ctx.repo);
    const err = await ctx.service.create(dto({ managerId: MANAGER }), admin).catch((e) => e);
    expect(err.statusCode).toBe(422);
    expect(err.details?.map((d: { field: string }) => d.field)).toContain(field);
    expect(ctx.repo.employees).toHaveLength(0);
  });

  it('answers 409 for a repeated employee code, whatever the letter case', async () => {
    await ctx.service.create(dto(), admin);
    await expect(
      ctx.service.create(dto({ employeeCode: 'emp-1001', email: 'other@maxr.internal' }), admin),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('code') });
    expect(ctx.repo.employees).toHaveLength(1);
  });

  it('answers 409 for a repeated email, whatever the letter case', async () => {
    await ctx.service.create(dto(), admin);
    await expect(
      ctx.service.create(
        dto({ employeeCode: 'EMP-1002', email: 'PRIYA.SHARMA@maxr.internal' }),
        admin,
      ),
    ).rejects.toMatchObject({ statusCode: 409, message: expect.stringContaining('email') });
  });

  it('a failure after the employee row leaves no employee, no email, no event and records the failure', async () => {
    ctx.repo.failAfterEmployee = new Error('user insert failed');
    await expect(ctx.service.create(dto(), admin)).rejects.toThrow('user insert failed');
    expect(ctx.repo.employees).toHaveLength(0);
    expect(ctx.repo.passwordHashes).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
    expect(await ctx.outbox.claimDue(10, new Date(Date.now() + 1000), 1000)).toHaveLength(0);
    expect(ctx.auditStore.find((e) => e.action === 'employee.create')).toMatchObject([
      { outcome: 'failure' },
    ]);
  });

  it('an audit failure undoes the creation (fail closed)', async () => {
    ctx.auditStore.failNextWith(new AuditError('audit store down'));
    await expect(ctx.service.create(dto(), admin)).rejects.toThrow();
    expect(ctx.repo.employees).toHaveLength(0);
    expect(await ctx.outbox.claimDue(10, new Date(Date.now() + 1000), 1000)).toHaveLength(0);
  });

  it('a welcome email that cannot be queued does not fail a creation that already committed', async () => {
    ctx.platform.notifications.enqueueEmail = async () => {
      throw new Error('outbox down');
    };
    const created = await ctx.service.create(dto(), admin);
    expect(created.status).toBe('pending');
    expect(ctx.repo.employees).toHaveLength(1);
  });
});
