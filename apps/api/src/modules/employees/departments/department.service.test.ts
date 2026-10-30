import { describe, expect, it } from 'vitest';
import { createLogger } from '../../../logging/logger';
import { createTestPlatform } from '../../../platform';
import { uuid } from '../../../test/helpers';
import { MemoryDepartmentRepository } from './department.repository';
import { DepartmentService, RequestContext } from './department.service';

function setup() {
  const { platform, auditStore } = createTestPlatform({
    logger: createLogger({ level: 'silent', write: () => undefined }),
  });
  const repo = new MemoryDepartmentRepository();
  const service = new DepartmentService(repo, platform);
  const ctx: RequestContext = {
    actorId: uuid,
    employeeId: uuid,
    requestId: 'req-test-123',
  };
  return { repo, service, platform, auditStore, ctx };
}

describe('DepartmentService (Unit Tests)', () => {
  it('creates a department successfully and records audit log and event', async () => {
    const { service, auditStore, platform, ctx } = setup();
    const events: unknown[] = [];
    platform.events.subscribe('department.created', (e) => {
      events.push(e);
    });

    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    expect(dept.id).toBeDefined();
    expect(dept.name).toBe('Engineering');
    expect(dept.code).toBe('ENG');
    expect(dept.isActive).toBe(true);

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'department' && e.entityId === dept.id,
    );
    expect(auditEntries.length).toBe(1);
    expect(auditEntries[0]?.action).toBe('department.create');
    expect(auditEntries[0]?.outcome).toBe('success');

    expect(events.length).toBe(1);
  });

  it('rejects duplicate department codes with 409 Conflict', async () => {
    const { service, ctx } = setup();
    await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    await expect(
      service.create({ name: 'Engineering Duplicate', code: 'eng' }, ctx),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('lists departments with search, filtering, and pagination', async () => {
    const { service, ctx } = setup();
    await service.create({ name: 'Engineering', code: 'ENG' }, ctx);
    await service.create({ name: 'Human Resources', code: 'HR' }, ctx);
    await service.create({ name: 'Operations', code: 'OPS' }, ctx);

    const page1 = await service.list({ page: 1, pageSize: 2, sortOrder: 'asc' });
    expect(page1.data.length).toBe(2);
    expect(page1.meta.total).toBe(3);
    expect(page1.meta.totalPages).toBe(2);

    const searchResult = await service.list({
      page: 1,
      pageSize: 20,
      sortOrder: 'asc',
      search: 'Human',
    });
    expect(searchResult.data.length).toBe(1);
    expect(searchResult.data[0]?.code).toBe('HR');
  });

  it('updates department details and logs audit entry', async () => {
    const { service, auditStore, ctx } = setup();
    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    const updated = await service.update(dept.id, { name: 'Core Engineering' }, ctx);
    expect(updated.name).toBe('Core Engineering');
    expect(updated.code).toBe('ENG');

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'department' && e.entityId === dept.id,
    );
    expect(auditEntries.some((e) => e.action === 'department.update')).toBe(true);
  });

  it('rejects updating department to an existing code of another department', async () => {
    const { service, ctx } = setup();
    const dept1 = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);
    await service.create({ name: 'Marketing', code: 'MKT' }, ctx);

    await expect(service.update(dept1.id, { code: 'MKT' }, ctx)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('deactivates an unreferenced active department', async () => {
    const { service, auditStore, ctx } = setup();
    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    await expect(service.deactivate(dept.id, ctx)).resolves.not.toThrow();

    const fetched = await service.getById(dept.id);
    expect(fetched.isActive).toBe(false);

    const auditEntries = auditStore.find(
      (e) => e.entityType === 'department' && e.entityId === dept.id,
    );
    expect(auditEntries.some((e) => e.action === 'department.deactivate')).toBe(true);
  });

  it('rejects deactivating an already inactive department with 422 Unprocessable', async () => {
    const { service, ctx } = setup();
    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);
    await service.deactivate(dept.id, ctx);

    await expect(service.deactivate(dept.id, ctx)).rejects.toMatchObject({
      statusCode: 422,
      code: 'UNPROCESSABLE_ENTITY',
    });
  });

  it('rejects deactivating a department with active designations (in-use guard)', async () => {
    const { service, repo, ctx } = setup();
    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    repo.setActiveDesignationChecker((id) => id === dept.id);

    await expect(service.deactivate(dept.id, ctx)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Cannot deactivate department with active designations',
    });
  });

  it('rejects deactivating a department with active employees (in-use guard)', async () => {
    const { service, repo, ctx } = setup();
    const dept = await service.create({ name: 'Engineering', code: 'ENG' }, ctx);

    repo.setActiveEmployeeChecker((id) => id === dept.id);

    await expect(service.deactivate(dept.id, ctx)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'Cannot deactivate department with active employees',
    });
  });

  it('throws 404 when department is not found', async () => {
    const { service } = setup();
    const missingId = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

    await expect(service.getById(missingId)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Department not found',
    });
  });
});
