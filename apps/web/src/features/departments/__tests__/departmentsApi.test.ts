import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildDepartmentQueryString,
  fetchDepartments,
  fetchDepartmentById,
  createDepartment,
  updateDepartment,
  deactivateDepartment,
  DepartmentsApiError,
} from '../api/departmentsApi';
import * as clientModule from '../../../api/client';
import type { Department } from '../types';

describe('Departments API: Query Builder & Service Functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildDepartmentQueryString', () => {
    it('returns empty string when no parameters are provided', () => {
      expect(buildDepartmentQueryString({})).toBe('');
    });

    it('omits undefined, null, or empty string values', () => {
      const qs = buildDepartmentQueryString({
        search: '   ',
        isActive: undefined,
      });
      expect(qs).toBe('');
    });

    it('formats active boolean as string true or false', () => {
      expect(buildDepartmentQueryString({ isActive: true })).toBe('isActive=true');
      expect(buildDepartmentQueryString({ isActive: false })).toBe('isActive=false');
    });

    it('builds a complete sanitized query string for all active parameters', () => {
      const qs = buildDepartmentQueryString({
        page: 2,
        pageSize: 25,
        sortBy: 'name',
        sortOrder: 'asc',
        search: '  Engineering  ',
        isActive: true,
      });

      const params = new URLSearchParams(qs);
      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('25');
      expect(params.get('sortBy')).toBe('name');
      expect(params.get('sortOrder')).toBe('asc');
      expect(params.get('search')).toBe('Engineering');
      expect(params.get('isActive')).toBe('true');
    });
  });

  describe('fetchDepartments', () => {
    it('calls apiFetch with correct URL and returns departments list and meta', async () => {
      const mockDepartments: Department[] = [
        {
          id: 'dept-1',
          name: 'Engineering',
          code: 'ENG',
          isActive: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const mockResponse = new Response(
        JSON.stringify({
          data: mockDepartments,
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const controller = new AbortController();
      const result = await fetchDepartments({ search: 'Eng', page: 1 }, controller.signal);

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/v1/departments?page=1&search=Eng',
        expect.objectContaining({ signal: controller.signal }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.name).toBe('Engineering');
      expect(result.meta.total).toBe(1);
    });

    it('throws DepartmentsApiError on API error envelope', async () => {
      const createErrorResponse = () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission',
              requestId: 'req-123',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );

      vi.spyOn(clientModule, 'apiFetch').mockImplementation(async () => createErrorResponse());

      await expect(fetchDepartments()).rejects.toThrow(DepartmentsApiError);
      await expect(fetchDepartments()).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission',
        requestId: 'req-123',
      });
    });
  });

  describe('fetchDepartmentById', () => {
    it('fetches a single department by id', async () => {
      const mockDept: Department = {
        id: 'dept-1',
        name: 'Design',
        code: 'DSGN',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: mockDept }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await fetchDepartmentById('dept-1');
      expect(result.name).toBe('Design');
      expect(result.code).toBe('DSGN');
    });

    it('throws DepartmentsApiError with 404 when department not found', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DEPARTMENT_NOT_FOUND',
            message: 'Department not found',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(fetchDepartmentById('non-existent')).rejects.toThrow(DepartmentsApiError);
    });
  });

  describe('createDepartment', () => {
    it('posts new department payload with idempotency key', async () => {
      const newDept: Department = {
        id: 'dept-new',
        name: 'Human Resources',
        code: 'HR',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: newDept }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await createDepartment({ name: 'Human Resources', code: 'HR' });

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = apiFetchSpy.mock.calls[0]!;
      expect(url).toBe('/api/v1/departments');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({ name: 'Human Resources', code: 'HR' });
      expect(result.id).toBe('dept-new');
    });

    it('handles 409 conflict code duplicate error', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DUPLICATE_CODE',
            message: 'A department with code HR already exists',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(createDepartment({ name: 'Human Resources', code: 'HR' })).rejects.toMatchObject(
        {
          status: 409,
          code: 'DUPLICATE_CODE',
        },
      );
    });
  });

  describe('updateDepartment', () => {
    it('sends PUT request with updated values', async () => {
      const updatedDept: Department = {
        id: 'dept-1',
        name: 'Engineering & Technology',
        code: 'ENG',
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: updatedDept }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await updateDepartment('dept-1', { name: 'Engineering & Technology' });

      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/v1/departments/dept-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'Engineering & Technology' }),
        }),
      );
      expect(result.name).toBe('Engineering & Technology');
    });
  });

  describe('deactivateDepartment', () => {
    it('sends POST request to deactivate endpoint', async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: { id: 'dept-1', isActive: false } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await deactivateDepartment('dept-1');

      expect(apiFetchSpy).toHaveBeenCalledWith('/api/v1/departments/dept-1/deactivate', {
        method: 'POST',
      });
      expect(result.isActive).toBe(false);
    });

    it('rejects with 409 conflict when department has active dependencies', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DEPARTMENT_IN_USE',
            message: 'Cannot deactivate department with active employees or designations',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(deactivateDepartment('dept-1')).rejects.toMatchObject({
        status: 409,
        code: 'DEPARTMENT_IN_USE',
      });
    });
  });
});
