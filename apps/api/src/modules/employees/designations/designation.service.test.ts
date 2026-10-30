import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { uuid } from '../../../test/helpers';
import { MemoryDesignationRepository } from './designation.repository';
import { DesignationService, RequestContext } from './designation.service';

function setup() {
  const { platform, auditStore } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const repo = new MemoryDesignationRepository();
  const service = new DesignationService(repo, platform);
  const deptId = uuid;
  const ctx: RequestContext = {
    actorId: uuid,
    employeeId: uuid,
    requestId: 'req-desig-123',
  };
  return { repo, service, platform, auditStore, deptId, ctx };
}

describe('DesignationService (Unit Tests)', () => {
  it('creates a designation successfully and records audit log and event', async () => {
    const { service, auditStore, platform, deptId, ctx } = setup();
    const events: unknown[] = [];
    platform.events.subscribe('designation.created', (e) => {
      events.push(e);
    });

    const desig = await service.create(
      { departmentId: deptId, title: 'Senior Software Engineer', code: 'SR_SWE', level: 3 },
      ctx,
    );

    expect(desig.id).toBeDefined();
    expect(desig.departmentId).toBe(deptId);
    expect(desig.title).toBe('Senior Software Engineer');
    expect(desig.code).toBe('SR_SWE');
    expect(desig.level).toBe(3);
    expect(desig.isActive).toBe(true);

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'designation' && e.entityId === desig.id,
    );
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]?.action).toBe('designation.create');

    expect(events.length).toBe(1);
  });

  it('rejects designation creation when referenced department is inactive or missing', async () => {
    const { service, repo, deptId, ctx } = setup();
    repo.setActiveDepartmentChecker(() => false);

    await expect(
      service.create(
        { departmentId: deptId, title: 'Lead Architect', code: 'ARCH', level: 5 },
        ctx,
      ),
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
      message: 'Referenced department does not exist or is inactive',
    });
  });

  it('rejects duplicate designation codes with 409 Conflict', async () => {
    const { service, deptId, ctx } = setup();
    await service.create({ departmentId: deptId, title: 'Engineer', code: 'ENG_1', level: 1 }, ctx);

    await expect(
      service.create({ departmentId: deptId, title: 'Engineer Two', code: 'eng_1', level: 2 }, ctx),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('lists designations with department filtering and pagination', async () => {
    const { service, deptId, ctx } = setup();
    await service.create({ departmentId: deptId, title: 'Engineer 1', code: 'E1', level: 1 }, ctx);
    await service.create({ departmentId: deptId, title: 'Engineer 2', code: 'E2', level: 2 }, ctx);

    const otherDeptId = '4f2b8c1e-5d4a-4b6f-9c0e-7a1d2e3f4a99';
    await service.create(
      { departmentId: otherDeptId, title: 'HR Associate', code: 'HRA', level: 1 },
      ctx,
    );

    const filtered = await service.list({
      page: 1,
      pageSize: 20,
      sortOrder: 'asc',
      departmentId: deptId,
    });
    expect(filtered.data.length).toBe(2);
    expect(filtered.meta.total).toBe(2);
  });

  it('updates designation and logs audit entry', async () => {
    const { service, auditStore, deptId, ctx } = setup();
    const desig = await service.create(
      { departmentId: deptId, title: 'Engineer', code: 'ENG_X', level: 1 },
      ctx,
    );

    const updated = await service.update(desig.id, { title: 'Staff Engineer', level: 4 }, ctx);
    expect(updated.title).toBe('Staff Engineer');
    expect(updated.level).toBe(4);

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'designation' && e.entityId === desig.id,
    );
    expect(auditEntries.some((e) => e.action === 'designation.update')).toBe(true);
  });

  it('deactivates an unreferenced designation', async () => {
    const { service, auditStore, deptId, ctx } = setup();
    const desig = await service.create(
      { departmentId: deptId, title: 'Intern', code: 'INT', level: 1 },
      ctx,
    );

    await expect(service.deactivate(desig.id, ctx)).resolves.not.toThrow();

    const fetched = await service.getById(desig.id);
    expect(fetched.isActive).toBe(false);

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'designation' && e.entityId === desig.id,
    );
    expect(auditEntries.some((e) => e.action === 'designation.deactivate')).toBe(true);
  });

  it('rejects deactivating an already inactive designation with 422 Unprocessable', async () => {
    const { service, deptId, ctx } = setup();
    const desig = await service.create(
      { departmentId: deptId, title: 'Intern', code: 'INT_2', level: 1 },
      ctx,
    );
    await service.deactivate(desig.id, ctx);

    await expect(service.deactivate(desig.id, ctx)).rejects.toMatchObject({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
    });
  });

  it('rejects deactivating a designation with active employees (in-use guard)', async () => {
    const { service, repo, deptId, ctx } = setup();
    const desig = await service.create(
      { departmentId: deptId, title: 'Tech Lead', code: 'TL', level: 4 },
      ctx,
    );

    repo.setActiveEmployeeChecker((id) => id === desig.id);

    await expect(service.deactivate(desig.id, ctx)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Cannot deactivate designation with active employees',
    });
  });

  it('throws 404 when designation is not found', async () => {
    const { service } = setup();
    const missingId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    await expect(service.getById(missingId)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Designation not found',
    });
  });

  it('guarantees deterministic pagination with stable sorting tie-breaker when levels match', async () => {
    const { service, deptId, ctx } = setup();
    const d1 = await service.create(
      { departmentId: deptId, title: 'Same Level A', code: 'SL_A', level: 3 },
      ctx,
    );
    const d2 = await service.create(
      { departmentId: deptId, title: 'Same Level B', code: 'SL_B', level: 3 },
      ctx,
    );
    const d3 = await service.create(
      { departmentId: deptId, title: 'Same Level C', code: 'SL_C', level: 3 },
      ctx,
    );

    const page1 = await service.list({
      page: 1,
      pageSize: 2,
      sortBy: 'level',
      sortOrder: 'asc',
      departmentId: deptId,
    });
    const page2 = await service.list({
      page: 2,
      pageSize: 2,
      sortBy: 'level',
      sortOrder: 'asc',
      departmentId: deptId,
    });

    expect(page1.data.length).toBe(2);
    expect(page2.data.length).toBe(1);
    expect(page1.meta.total).toBe(3);

    const idsPage1 = page1.data.map((d) => d.id);
    const idsPage2 = page2.data.map((d) => d.id);

    expect(idsPage1.includes(idsPage2[0]!)).toBe(false);
    expect([...idsPage1, ...idsPage2].sort()).toEqual([d1.id, d2.id, d3.id].sort());
  });
});
