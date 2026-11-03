import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createEmployee,
  generateIdempotencyKey,
  fetchActiveDepartments,
  fetchDesignationsByDepartment,
  fetchEligibleManagers,
  CreateEmployeeApiError,
} from '../api/creation';
import type { CreateEmployeePayload } from '../types';

describe('Employee Creation API Client (Issue #20)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('generateIdempotencyKey', () => {
    it('generates a non-empty unique string key', () => {
      const key1 = generateIdempotencyKey();
      const key2 = generateIdempotencyKey();
      expect(key1).toBeTruthy();
      expect(key2).toBeTruthy();
      expect(key1).not.toBe(key2);
    });
  });

  describe('createEmployee', () => {
    const validPayload: CreateEmployeePayload = {
      employeeCode: 'EMP-001',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'Jane.Doe@EXAMPLE.com',
      phone: '+91 98765 43210',
      departmentId: '11111111-1111-1111-1111-111111111111',
      designationId: '22222222-2222-2222-2222-222222222222',
      managerId: '33333333-3333-3333-3333-333333333333',
      joiningDate: '2026-11-15',
      role: 'staff',
    };

    it('sends POST /api/v1/employees with Idempotency-Key and normalized payload', async () => {
      const mockCreated = {
        id: 'emp-new',
        userId: 'usr-new',
        employeeCode: 'EMP-001',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        phone: '+91 98765 43210',
        departmentId: '11111111-1111-1111-1111-111111111111',
        designationId: '22222222-2222-2222-2222-222222222222',
        managerId: '33333333-3333-3333-3333-333333333333',
        status: 'pending',
        role: 'staff',
        joiningDate: '2026-11-15',
        createdAt: '2026-11-02T10:00:00.000Z',
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: mockCreated }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const idempotencyKey = 'test-idemp-12345';
      const result = await createEmployee(validPayload, idempotencyKey);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/v1/employees');
      expect(init.method).toBe('POST');

      // Verify headers
      const getHeader = (h: unknown, name: string): string | null => {
        if (h instanceof Headers) return h.get(name);
        if (h && typeof h === 'object') {
          return (
            (h as Record<string, string>)[name] ||
            (h as { get?: (k: string) => string }).get?.(name) ||
            null
          );
        }
        return null;
      };
      expect(getHeader(init.headers, 'Idempotency-Key')).toBe(idempotencyKey);
      expect(getHeader(init.headers, 'Content-Type')).toBe('application/json');

      // Verify clean body and normalization (email lowercase, trimmed strings)
      const parsedBody = JSON.parse(init.body as string);
      expect(parsedBody.email).toBe('jane.doe@example.com');
      expect(parsedBody.employeeCode).toBe('EMP-001');
      expect(parsedBody.phone).toBe('+91 98765 43210');
      expect(parsedBody.managerId).toBe('33333333-3333-3333-3333-333333333333');

      // Ensure no disallowed fields were passed
      expect(parsedBody.status).toBeUndefined();
      expect(parsedBody.isActive).toBeUndefined();
      expect(parsedBody.password).toBeUndefined();
      expect(parsedBody.userId).toBeUndefined();

      expect(result.id).toBe('emp-new');
      expect(result.status).toBe('pending');
    });

    it('omits optional phone and managerId if empty strings are provided', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { id: 'emp-2', status: 'pending' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const payloadWithoutOptionals: CreateEmployeePayload = {
        ...validPayload,
        phone: '',
        managerId: '',
      };

      await createEmployee(payloadWithoutOptionals, 'key-2');
      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      const parsedBody = JSON.parse(init.body as string);

      expect(parsedBody.phone).toBeUndefined();
      expect(parsedBody.managerId).toBeUndefined();
    });

    it('maps 409 duplicate employee code error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'An employee with this code already exists',
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(createEmployee(validPayload, 'key-conflict')).rejects.toThrow(
        CreateEmployeeApiError,
      );

      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'An employee with this code already exists',
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await createEmployee(validPayload, 'key-conflict');
      } catch (err) {
        const apiErr = err as CreateEmployeeApiError;
        expect(apiErr.status).toBe(409);
        expect(apiErr.fieldErrors.employeeCode).toBe('An employee with this code already exists');
      }
    });

    it('maps 409 duplicate email error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'An employee or account with this email already exists',
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await createEmployee(validPayload, 'key-conflict-email');
      } catch (err) {
        const apiErr = err as CreateEmployeeApiError;
        expect(apiErr.status).toBe(409);
        expect(apiErr.fieldErrors.email).toBe(
          'An employee or account with this email already exists',
        );
      }
    });

    it('maps 422 unprocessable entity details to field errors', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message: 'The department, designation or manager is not usable',
              details: [
                { field: 'departmentId', message: 'Department is not active' },
                {
                  field: 'designationId',
                  message: 'Designation does not belong to the department',
                },
                { field: 'managerId', message: 'Manager is not an active employee' },
              ],
            },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await createEmployee(validPayload, 'key-422');
      } catch (err) {
        const apiErr = err as CreateEmployeeApiError;
        expect(apiErr.status).toBe(422);
        expect(apiErr.fieldErrors.departmentId).toBe('Department is not active');
        expect(apiErr.fieldErrors.designationId).toBe(
          'Designation does not belong to the department',
        );
        expect(apiErr.fieldErrors.managerId).toBe('Manager is not an active employee');
      }
    });

    it('handles 403 forbidden error', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Only an Admin can create an account with this role',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await createEmployee({ ...validPayload, role: 'admin' }, 'key-403');
      } catch (err) {
        const apiErr = err as CreateEmployeeApiError;
        expect(apiErr.status).toBe(403);
        expect(apiErr.message).toBe('Only an Admin can create an account with this role');
      }
    });
  });

  describe('fetchActiveDepartments', () => {
    it('fetches departments and filters active entries', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              { id: 'dept-1', name: 'Engineering', code: 'ENG', isActive: true },
              { id: 'dept-2', name: 'Archived Dept', code: 'ARC', isActive: false },
              { id: 'dept-3', name: 'Human Resources', code: 'HR', isActive: true },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const depts = await fetchActiveDepartments();
      expect(depts).toHaveLength(2);
      expect(depts.map((d) => d.id)).toEqual(['dept-1', 'dept-3']);
      expect(depts[0]?.name).toBe('Engineering');
    });

    it('returns empty array on error', async () => {
      fetchMock.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));
      const depts = await fetchActiveDepartments();
      expect(depts).toEqual([]);
    });
  });

  describe('fetchDesignationsByDepartment', () => {
    it('fetches designations filtered by departmentId', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'desig-1',
                title: 'Software Engineer',
                code: 'SWE',
                departmentId: 'dept-1',
                isActive: true,
              },
              {
                id: 'desig-2',
                title: 'QA Engineer',
                code: 'QA',
                departmentId: 'dept-1',
                isActive: true,
              },
              {
                id: 'desig-3',
                title: 'Inactive Title',
                code: 'INA',
                departmentId: 'dept-1',
                isActive: false,
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const desigs = await fetchDesignationsByDepartment('dept-1');
      expect(desigs).toHaveLength(2);
      expect(desigs.map((d) => d.id)).toEqual(['desig-2', 'desig-1']); // Sorted by title: QA Engineer, Software Engineer
    });

    it('returns empty array if no departmentId provided', async () => {
      const desigs = await fetchDesignationsByDepartment('');
      expect(desigs).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchEligibleManagers', () => {
    it('fetches active employees formatted with name and employeeCode', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: 'mgr-1',
                firstName: 'Arun',
                lastName: 'Kumar',
                employeeCode: 'MGR-001',
                status: 'active',
              },
              {
                id: 'mgr-2',
                firstName: 'Bala',
                lastName: 'Subramanian',
                employeeCode: 'MGR-002',
                status: 'active',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const managers = await fetchEligibleManagers();
      expect(managers).toHaveLength(2);
      expect(managers[0]?.name).toBe('Arun Kumar');
      expect(managers[0]?.employeeCode).toBe('MGR-001');
    });
  });
});
