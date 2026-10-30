import { ROLES, type Role } from '@maxr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { AuditError } from '../../../platform/audit/types';
import { ScopeFilter } from '../../rbac';
import { MemoryEmployeeDetailRepository } from './detail.repository.memory';
import { EmployeeDetailService } from './detail.service';
import { EmployeeDetail } from './detail.types';

const ID = '91000000-0000-4000-8000-000000000001';
const OTHER = '91000000-0000-4000-8000-000000000002';
const MANAGER = '91000000-0000-4000-8000-000000000003';
const DEPT = '92000000-0000-4000-8000-000000000001';
const DEPT_B = '92000000-0000-4000-8000-000000000002';
const DESIG = '93000000-0000-4000-8000-000000000001';

const detail = (id: string, overrides: Partial<EmployeeDetail> = {}): EmployeeDetail => ({
  id,
  employeeCode: id === ID ? 'EMP-1' : 'EMP-2',
  firstName: 'Asha',
  lastName: 'Rao',
  email: id === ID ? 'asha@maxr.internal' : 'other@maxr.internal',
  phone: '+91 90000 00001',
  department: { id: DEPT, name: 'Engineering', code: 'ENG' },
  designation: { id: DESIG, title: 'Engineer', code: 'ENG-1' },
  manager: null,
  status: 'active',
  joiningDate: '2026-01-15',
  createdAt: '2026-01-15T00:00:00.000Z',
  updatedAt: '2026-01-15T00:00:00.000Z',
  version: 1,
  account: { userId: `u-${id}`, isActive: true, lastLoginAt: null, roles: [ROLES.STAFF] },
  ...overrides,
});

const caller = (roles: Role[]) => ({ actorId: 'u-actor', roles, requestId: 'req-1' });
const admin = caller([ROLES.ADMIN]);
const hr = caller([ROLES.HR_MANAGER]);
const ALL: ScopeFilter = { kind: 'all' };

function build() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new MemoryEmployeeDetailRepository([
    { detail: detail(ID), managerId: MANAGER },
    { detail: detail(OTHER), managerId: null },
  ]);
  repo.references.designation = { isActive: true, departmentId: DEPT };
  const service = new EmployeeDetailService(repo, platform);
  const events: unknown[] = [];
  platform.events.subscribe('employee.updated', (e) => {
    events.push(e.payload);
  });
  return { service, repo, auditStore, events };
}

describe('EmployeeDetailService.get', () => {
  it('shows login information to HR and Admin only', async () => {
    const { service } = build();
    expect((await service.get(ID, ALL, hr)).account).toBeDefined();
    expect((await service.get(ID, ALL, admin)).account?.roles).toEqual([ROLES.STAFF]);
    expect((await service.get(ID, ALL, caller([ROLES.TEAM_LEAD]))).account).toBeUndefined();
    expect((await service.get(ID, ALL, caller([ROLES.STAFF]))).account).toBeUndefined();
  });

  it('answers 404 outside the scope and for a missing employee, alike', async () => {
    const { service } = build();
    const teamOfSomeoneElse: ScopeFilter = { kind: 'team', managerId: 'someone-else' };
    const hidden = await service.get(ID, teamOfSomeoneElse, hr).catch((e) => e);
    const missing = await service.get('no-such-id', ALL, hr).catch((e) => e);
    expect(hidden.statusCode).toBe(404);
    expect(missing.statusCode).toBe(404);
    expect(hidden.message).toBe(missing.message);
  });

  it('lets a Team Lead read a direct report and nobody else', async () => {
    const { service } = build();
    const team: ScopeFilter = { kind: 'team', managerId: MANAGER };
    expect((await service.get(ID, team, caller([ROLES.TEAM_LEAD]))).id).toBe(ID);
    await expect(service.get(OTHER, team, caller([ROLES.TEAM_LEAD]))).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});

describe('EmployeeDetailService.update', () => {
  let ctx: ReturnType<typeof build>;
  beforeEach(() => {
    ctx = build();
  });

  it('changes the fields, bumps the version, audits field names only and announces it', async () => {
    const updated = await ctx.service.update(
      ID,
      { version: 1, firstName: 'Ashwini', phone: '+91 91111 11111' },
      hr,
      ALL,
    );
    expect(updated).toMatchObject({ firstName: 'Ashwini', phone: '+91 91111 11111', version: 2 });
    expect(updated.account).toBeDefined();

    const [entry, ...rest] = ctx.auditStore.find((e) => e.action === 'employee.update');
    expect(rest).toHaveLength(0);
    expect(entry).toMatchObject({
      outcome: 'success',
      entityId: ID,
      actorId: 'u-actor',
      changes: { fields: ['firstName', 'phone'] },
    });
    // Personal data stays out of the trail.
    expect(JSON.stringify(entry)).not.toContain('Ashwini');
    expect(JSON.stringify(entry)).not.toContain('91111');
    expect(ctx.events).toEqual([{ employeeId: ID, fields: ['firstName', 'phone'] }]);
  });

  it('records the old and new ids when the department or designation changes', async () => {
    ctx.repo.references.designation = { isActive: true, departmentId: DEPT_B };
    await ctx.service.update(
      ID,
      { version: 1, departmentId: DEPT_B, designationId: '93000000-0000-4000-8000-000000000009' },
      admin,
      ALL,
    );
    expect(ctx.auditStore.find((e) => e.action === 'employee.update')[0]?.changes).toMatchObject({
      fields: ['departmentId', 'designationId'],
      departmentId: { from: DEPT, to: DEPT_B },
      designationId: { from: DESIG, to: '93000000-0000-4000-8000-000000000009' },
    });
  });

  it('lets an Admin change the code and the email', async () => {
    const updated = await ctx.service.update(
      ID,
      { version: 1, employeeCode: 'EMP-99', email: 'new@maxr.internal' },
      admin,
      ALL,
    );
    expect(updated).toMatchObject({ employeeCode: 'EMP-99', email: 'new@maxr.internal' });
  });

  it.each([{ employeeCode: 'EMP-99' }, { email: 'new@maxr.internal' }])(
    'an HR Manager cannot change %o; nothing is written',
    async (change) => {
      await expect(
        ctx.service.update(ID, { version: 1, ...change }, hr, ALL),
      ).rejects.toMatchObject({
        statusCode: 403,
      });
      expect((await ctx.service.get(ID, ALL, admin)).version).toBe(1);
    },
  );

  it('answers 409 for a stale version and writes nothing', async () => {
    await ctx.service.update(ID, { version: 1, firstName: 'First' }, hr, ALL);
    await expect(
      ctx.service.update(ID, { version: 1, firstName: 'Second' }, hr, ALL),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect((await ctx.service.get(ID, ALL, admin)).firstName).toBe('First');
  });

  it('writes nothing and keeps the version when no value actually changes', async () => {
    const same = await ctx.service.update(
      ID,
      { version: 1, firstName: 'Asha', phone: '+91 90000 00001' },
      hr,
      ALL,
    );
    expect(same.version).toBe(1);
    expect(ctx.auditStore.find((e) => e.action === 'employee.update')).toHaveLength(0);
    expect(ctx.events).toHaveLength(0);
  });

  it('clears the phone with null', async () => {
    expect((await ctx.service.update(ID, { version: 1, phone: null }, hr, ALL)).phone).toBeNull();
  });

  it('answers 404 outside the scope, before it looks at the version', async () => {
    await expect(
      ctx.service.update(ID, { version: 99, firstName: 'X' }, hr, { kind: 'team', managerId: 'z' }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('refuses to edit a deactivated employee', async () => {
    ctx.repo.employees[0]!.detail.status = 'deactivated';
    await expect(
      ctx.service.update(ID, { version: 1, firstName: 'X' }, hr, ALL),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it.each([
    [
      'a designation of another department',
      { designationId: DESIG, departmentId: DEPT_B },
      {
        isActive: true,
        departmentId: DEPT,
      },
    ],
    [
      'an inactive designation',
      { designationId: '93000000-0000-4000-8000-000000000009' },
      { isActive: false, departmentId: DEPT },
    ],
  ])('rejects %s with 422 and writes nothing', async (_name, change, designation) => {
    ctx.repo.references.designation = designation;
    const err = await ctx.service.update(ID, { version: 1, ...change }, hr, ALL).catch((e) => e);
    expect(err.statusCode).toBe(422);
    expect(err.details?.map((d: { field: string }) => d.field)).toContain('designationId');
    expect((await ctx.service.get(ID, ALL, admin)).version).toBe(1);
  });

  it('rejects an inactive department with 422', async () => {
    ctx.repo.references.department = { isActive: false };
    await expect(
      ctx.service.update(ID, { version: 1, departmentId: DEPT_B }, hr, ALL),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('answers 409 for a code or an email that is taken', async () => {
    await expect(
      ctx.service.update(ID, { version: 1, employeeCode: 'emp-2' }, admin, ALL),
    ).rejects.toMatchObject({ statusCode: 409 });
    await expect(
      ctx.service.update(ID, { version: 1, email: 'OTHER@maxr.internal' }, admin, ALL),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('a failure while writing leaves the employee as it was and audits the failure', async () => {
    ctx.repo.failAfterPatch = new Error('write failed');
    await expect(
      ctx.service.update(ID, { version: 1, firstName: 'Lost' }, hr, ALL),
    ).rejects.toThrow('write failed');
    const after = await ctx.service.get(ID, ALL, admin);
    expect(after).toMatchObject({ firstName: 'Asha', version: 1 });
    expect(ctx.events).toHaveLength(0);
    expect(ctx.auditStore.find((e) => e.action === 'employee.update')).toMatchObject([
      { outcome: 'failure' },
    ]);
  });

  it('an audit failure undoes the edit (fail closed)', async () => {
    ctx.auditStore.failNextWith(new AuditError('audit store down'));
    await expect(
      ctx.service.update(ID, { version: 1, firstName: 'Lost' }, hr, ALL),
    ).rejects.toThrow();
    expect((await ctx.service.get(ID, ALL, admin)).firstName).toBe('Asha');
  });
});
