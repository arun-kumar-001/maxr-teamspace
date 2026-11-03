import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchEmployeeDetail, updateEmployeeDetail, EmployeeDetailApiError } from '../api/detail';
import type { EmployeeDetail } from '../types';

describe('Employee Detail API Client (Issue #21)', () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  const mockEmployee: EmployeeDetail = {
    id: '11111111-1111-1111-1111-111111111111',
    employeeCode: 'EMP-001',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '+91 98765 43210',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'Software Engineer', code: 'SWE' },
    manager: { id: 'mgr-1', firstName: 'Kavita', lastName: 'Iyer', employeeCode: 'MGR-001' },
    status: 'active',
    joiningDate: '2026-01-15',
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-01-15T09:00:00Z',
    version: 3,
    account: {
      userId: 'usr-1',
      isActive: true,
      lastLoginAt: '2026-11-01T10:30:00Z',
      roles: ['staff'],
    },
  };

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('fetchEmployeeDetail', () => {
    it('successfully retrieves employee details with version and account info', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: mockEmployee }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await fetchEmployeeDetail('11111111-1111-1111-1111-111111111111');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/employees/11111111-1111-1111-1111-111111111111'),
        expect.objectContaining({ signal: undefined }),
      );
      expect(result.id).toBe(mockEmployee.id);
      expect(result.version).toBe(3);
      expect(result.account?.isActive).toBe(true);
    });

    it('throws EmployeeDetailApiError with isNotFound=true on 404 response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'NOT_FOUND',
              message: 'Employee not found',
            },
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        await fetchEmployeeDetail('unknown-id');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as EmployeeDetailApiError;
        expect(error.status).toBe(404);
        expect(error.isNotFound).toBe(true);
        expect(error.message).toBe('Employee not found');
      }
    });

    it('throws EmployeeDetailApiError with isForbidden=true on 403 response', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Insufficient permissions',
            },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        await fetchEmployeeDetail('forbidden-id');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as EmployeeDetailApiError;
        expect(error.status).toBe(403);
        expect(error.isForbidden).toBe(true);
      }
    });
  });

  describe('updateEmployeeDetail', () => {
    it('sends PUT /api/v1/employees/:id with version and changed fields', async () => {
      const updatedEmployee = {
        ...mockEmployee,
        firstName: 'Janet',
        version: 4,
      };

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ data: updatedEmployee }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      const result = await updateEmployeeDetail('11111111-1111-1111-1111-111111111111', {
        firstName: 'Janet',
        version: 3,
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/employees/11111111-1111-1111-1111-111111111111'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            firstName: 'Janet',
            version: 3,
          }),
        }),
      );
      expect(result.firstName).toBe('Janet');
      expect(result.version).toBe(4);
    });

    it('throws 409 conflict error on stale version mismatch', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'This employee was changed by someone else. Reload and try again',
            },
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        await updateEmployeeDetail('11111111-1111-1111-1111-111111111111', {
          firstName: 'Janet',
          version: 2,
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as EmployeeDetailApiError;
        expect(error.status).toBe(409);
        expect(error.isConflict).toBe(true);
        expect(error.message).toContain('Reload and try again');
      }
    });

    it('throws 422 unprocessable error for deactivated employee or bad references', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNPROCESSABLE_ENTITY',
              message: 'A deactivated employee cannot be edited',
            },
          }),
          {
            status: 422,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        await updateEmployeeDetail('11111111-1111-1111-1111-111111111111', {
          firstName: 'Janet',
          version: 3,
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as EmployeeDetailApiError;
        expect(error.status).toBe(422);
        expect(error.isUnprocessable).toBe(true);
      }
    });

    it('throws 403 forbidden error when non-admin edits code or email', async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'Only an Admin can change the employee code or the email',
            },
          }),
          {
            status: 403,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      );

      try {
        await updateEmployeeDetail('11111111-1111-1111-1111-111111111111', {
          employeeCode: 'NEW-CODE',
          version: 3,
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        const error = err as EmployeeDetailApiError;
        expect(error.status).toBe(403);
        expect(error.isForbidden).toBe(true);
      }
    });
  });
});
