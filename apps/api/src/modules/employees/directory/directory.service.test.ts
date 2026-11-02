import { randomUUID } from 'crypto';
import { describe, expect, it } from 'vitest';
import { MemoryEmployeeDirectoryRepository } from './directory.repository';
import { employeeDirectoryQuerySchema } from './directory.schemas';
import { EmployeeDirectoryService } from './directory.service';
import { EmployeeDirectoryItem } from './directory.types';

const makeEmployee = (overrides: Partial<EmployeeDirectoryItem> = {}): EmployeeDirectoryItem => {
  const id = overrides.id ?? randomUUID();
  const code = overrides.employeeCode ?? `EMP-${id.slice(0, 6)}`;
  return {
    id,
    employeeCode: code,
    firstName: overrides.firstName ?? 'Jane',
    lastName: overrides.lastName ?? 'Doe',
    email: overrides.email ?? `${code.toLowerCase()}@example.com`,
    phone: overrides.phone ?? '+1234567890',
    department: overrides.department ?? {
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Engineering',
      code: 'ENG',
    },
    designation: overrides.designation ?? {
      id: '22222222-2222-2222-2222-222222222222',
      title: 'Software Engineer',
      code: 'SWE',
      level: 2,
    },
    manager: overrides.manager ?? null,
    status: overrides.status ?? 'active',
    joiningDate: overrides.joiningDate ?? '2024-01-15',
    createdAt: overrides.createdAt ?? '2024-01-15T08:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2024-01-15T08:00:00.000Z',
  };
};

describe('EmployeeDirectoryService (Unit Tests)', () => {
  it('lists employees with default pagination and ALL scope', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    for (let i = 1; i <= 25; i++) {
      repo.add(
        makeEmployee({
          employeeCode: `EMP-${String(i).padStart(3, '0')}`,
          firstName: `Person${i}`,
          lastName: 'Test',
        }),
      );
    }

    const res = await service.list({}, { kind: 'all' });
    expect(res.data.length).toBe(20);
    expect(res.meta.page).toBe(1);
    expect(res.meta.pageSize).toBe(20);
    expect(res.meta.total).toBe(25);
    expect(res.meta.totalPages).toBe(2);

    const page2 = await service.list({ page: 2, pageSize: 20 }, { kind: 'all' });
    expect(page2.data.length).toBe(5);
    expect(page2.meta.page).toBe(2);
  });

  it('filters employees by departmentId, designationId, and status', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    const deptA = { id: randomUUID(), name: 'Dept A', code: 'DA' };
    const deptB = { id: randomUUID(), name: 'Dept B', code: 'DB' };
    const desig1 = { id: randomUUID(), title: 'Desig 1', code: 'D1', level: 1 };
    const desig2 = { id: randomUUID(), title: 'Desig 2', code: 'D2', level: 2 };

    const e1 = makeEmployee({ department: deptA, designation: desig1, status: 'active' });
    const e2 = makeEmployee({ department: deptA, designation: desig2, status: 'active' });
    const e3 = makeEmployee({ department: deptB, designation: desig1, status: 'pending' });
    const e4 = makeEmployee({ department: deptB, designation: desig2, status: 'deactivated' });

    repo.add(e1);
    repo.add(e2);
    repo.add(e3);
    repo.add(e4);

    // Department filter
    const deptRes = await service.list({ departmentId: deptA.id }, { kind: 'all' });
    expect(deptRes.meta.total).toBe(2);
    expect(deptRes.data.map((d) => d.id).sort()).toEqual([e1.id, e2.id].sort());

    // Designation filter
    const desigRes = await service.list({ designationId: desig1.id }, { kind: 'all' });
    expect(desigRes.meta.total).toBe(2);
    expect(desigRes.data.map((d) => d.id).sort()).toEqual([e1.id, e3.id].sort());

    // Status filter
    const pendingRes = await service.list({ status: 'pending' }, { kind: 'all' });
    expect(pendingRes.meta.total).toBe(1);
    expect(pendingRes.data[0]?.id).toBe(e3.id);
  });

  it('searches employees across code, name, and email', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    const e1 = makeEmployee({
      employeeCode: 'EMP-901',
      firstName: 'Alice',
      lastName: 'Wonderland',
      email: 'alice@company.com',
    });
    const e2 = makeEmployee({
      employeeCode: 'EMP-902',
      firstName: 'Bob',
      lastName: 'Builder',
      email: 'bob@company.com',
    });
    const e3 = makeEmployee({
      employeeCode: 'EMP-903',
      firstName: 'Charlie',
      lastName: 'Chocolate',
      email: 'charlie@wonder.com',
    });

    repo.add(e1);
    repo.add(e2);
    repo.add(e3);

    // Search by last name
    const res1 = await service.list({ search: 'Wonder' }, { kind: 'all' });
    expect(res1.meta.total).toBe(2); // Alice Wonderland (lastName) and Charlie (wonder.com email)
    expect(res1.data.map((d) => d.id).sort()).toEqual([e1.id, e3.id].sort());

    // Search by code
    const res2 = await service.list({ search: '902' }, { kind: 'all' });
    expect(res2.meta.total).toBe(1);
    expect(res2.data[0]?.id).toBe(e2.id);

    // Search by first name
    const res3 = await service.list({ search: 'charlie' }, { kind: 'all' });
    expect(res3.meta.total).toBe(1);
    expect(res3.data[0]?.id).toBe(e3.id);
  });

  it('enforces TEAM scope: Team Lead sees strictly direct reports, excluding self and others', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    const leadId = randomUUID();
    const otherLeadId = randomUUID();

    const leadEmployee = makeEmployee({
      id: leadId,
      firstName: 'Lead',
      lastName: 'User',
      manager: null,
    });
    const report1 = makeEmployee({
      firstName: 'Direct',
      lastName: 'One',
      manager: {
        id: leadId,
        firstName: 'Lead',
        lastName: 'User',
        employeeCode: leadEmployee.employeeCode,
      },
    });
    const report2 = makeEmployee({
      firstName: 'Direct',
      lastName: 'Two',
      manager: {
        id: leadId,
        firstName: 'Lead',
        lastName: 'User',
        employeeCode: leadEmployee.employeeCode,
      },
    });
    const otherTeamReport = makeEmployee({
      firstName: 'Other',
      lastName: 'Member',
      manager: {
        id: otherLeadId,
        firstName: 'Other',
        lastName: 'Lead',
        employeeCode: 'EMP-OTH',
      },
    });

    repo.add(leadEmployee);
    repo.add(report1);
    repo.add(report2);
    repo.add(otherTeamReport);

    // Caller has TEAM scope for leadId
    const res = await service.list({}, { kind: 'team', managerId: leadId });
    expect(res.meta.total).toBe(2);
    const returnedIds = res.data.map((d) => d.id);
    expect(returnedIds.sort()).toEqual([report1.id, report2.id].sort());

    // Verifies lead self is NOT in the list (D-26)
    expect(returnedIds.includes(leadId)).toBe(false);
    // Verifies other team's members are NOT in the list
    expect(returnedIds.includes(otherTeamReport.id)).toBe(false);
  });

  it('returns empty when filter kind is none', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    repo.add(makeEmployee());
    repo.add(makeEmployee());

    const res = await service.list({}, { kind: 'none' });
    expect(res.meta.total).toBe(0);
    expect(res.data).toEqual([]);
  });

  it('guarantees deterministic pagination with stable sorting tie-breaker when names match', async () => {
    const repo = new MemoryEmployeeDirectoryRepository();
    const service = new EmployeeDirectoryService(repo);

    const e1 = makeEmployee({ firstName: 'Same', lastName: 'Name' });
    const e2 = makeEmployee({ firstName: 'Same', lastName: 'Name' });
    const e3 = makeEmployee({ firstName: 'Same', lastName: 'Name' });

    repo.add(e1);
    repo.add(e2);
    repo.add(e3);

    const page1 = await service.list(
      { page: 1, pageSize: 2, sortBy: 'name', sortOrder: 'asc' },
      { kind: 'all' },
    );
    const page2 = await service.list(
      { page: 2, pageSize: 2, sortBy: 'name', sortOrder: 'asc' },
      { kind: 'all' },
    );

    expect(page1.data.length).toBe(2);
    expect(page2.data.length).toBe(1);
    expect(page1.meta.total).toBe(3);

    const ids1 = page1.data.map((d) => d.id);
    const ids2 = page2.data.map((d) => d.id);

    // No row repeated across pages
    expect(ids1.includes(ids2[0]!)).toBe(false);
    expect([...ids1, ...ids2].sort()).toEqual([e1.id, e2.id, e3.id].sort());
  });

  it('rejects unknown query keys in employeeDirectoryQuerySchema', () => {
    const unknownKeyResult = employeeDirectoryQuerySchema.safeParse({ bogus: '1' });
    expect(unknownKeyResult.success).toBe(false);

    const validResult = employeeDirectoryQuerySchema.safeParse({
      page: '2',
      pageSize: '30',
      sortBy: 'employeeCode',
      sortOrder: 'desc',
      status: 'active',
    });
    expect(validResult.success).toBe(true);
    if (validResult.success) {
      expect(validResult.data.page).toBe(2);
      expect(validResult.data.pageSize).toBe(30);
      expect(validResult.data.sortBy).toBe('employeeCode');
      expect(validResult.data.sortOrder).toBe('desc');
      expect(validResult.data.status).toBe('active');
    }
  });
});
