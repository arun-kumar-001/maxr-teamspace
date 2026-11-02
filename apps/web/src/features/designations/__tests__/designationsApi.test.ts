import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildDesignationQueryString,
  fetchDesignations,
  fetchDesignationById,
  createDesignation,
  updateDesignation,
  deactivateDesignation,
  fetchDepartmentOptions,
  DesignationsApiError,
} from '../api/designationsApi';
import * as clientModule from '../../../api/client';
import type { Designation } from '../types';

describe('Designations API: Query Builder & Service Functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildDesignationQueryString', () => {
    it('returns empty string when no parameters are provided', () => {
      expect(buildDesignationQueryString({})).toBe('');
    });

    it('omits undefined, null, or empty string values', () => {
      const qs = buildDesignationQueryString({
        search: '   ',
        departmentId: '',
        isActive: undefined,
      });
      expect(qs).toBe('');
    });

    it('formats active boolean as string true or false', () => {
      expect(buildDesignationQueryString({ isActive: true })).toBe('isActive=true');
      expect(buildDesignationQueryString({ isActive: false })).toBe('isActive=false');
    });

    it('builds a complete sanitized query string for all active parameters', () => {
      const qs = buildDesignationQueryString({
        page: 3,
        pageSize: 15,
        sortBy: 'level',
        sortOrder: 'desc',
        search: '  Architect  ',
        departmentId: 'dept-123',
        isActive: true,
      });

      const params = new URLSearchParams(qs);
      expect(params.get('page')).toBe('3');
      expect(params.get('pageSize')).toBe('15');
      expect(params.get('sortBy')).toBe('level');
      expect(params.get('sortOrder')).toBe('desc');
      expect(params.get('search')).toBe('Architect');
      expect(params.get('departmentId')).toBe('dept-123');
      expect(params.get('isActive')).toBe('true');
    });
  });

  describe('fetchDesignations', () => {
    it('calls apiFetch with correct URL and returns designations list and meta', async () => {
      const mockDesignations: Designation[] = [
        {
          id: 'desig-1',
          departmentId: 'dept-1',
          title: 'Senior Software Engineer',
          code: 'SR_SWE',
          level: 3,
          isActive: true,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        },
      ];

      const mockResponse = new Response(
        JSON.stringify({
          data: mockDesignations,
          meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const controller = new AbortController();
      const result = await fetchDesignations(
        { search: 'Senior', departmentId: 'dept-1', page: 1 },
        controller.signal,
      );

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/v1/designations?page=1&search=Senior&departmentId=dept-1',
        expect.objectContaining({ signal: controller.signal }),
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.title).toBe('Senior Software Engineer');
      expect(result.meta.total).toBe(1);
    });

    it('throws DesignationsApiError on API error envelope', async () => {
      const createErrorResponse = () =>
        new Response(
          JSON.stringify({
            error: {
              code: 'FORBIDDEN',
              message: 'You do not have permission',
              requestId: 'req-456',
            },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        );

      vi.spyOn(clientModule, 'apiFetch').mockImplementation(async () => createErrorResponse());

      await expect(fetchDesignations()).rejects.toThrow(DesignationsApiError);
      await expect(fetchDesignations()).rejects.toMatchObject({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission',
        requestId: 'req-456',
      });
    });
  });

  describe('fetchDesignationById', () => {
    it('fetches a single designation by id', async () => {
      const mockDesig: Designation = {
        id: 'desig-1',
        departmentId: 'dept-1',
        title: 'Lead Architect',
        code: 'LEAD_ARCH',
        level: 5,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: mockDesig }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await fetchDesignationById('desig-1');
      expect(result.title).toBe('Lead Architect');
      expect(result.level).toBe(5);
    });

    it('throws DesignationsApiError with 404 when designation not found', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DESIGNATION_NOT_FOUND',
            message: 'Designation not found',
          },
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(fetchDesignationById('non-existent')).rejects.toThrow(DesignationsApiError);
    });
  });

  describe('createDesignation', () => {
    it('posts new designation payload with idempotency key', async () => {
      const newDesig: Designation = {
        id: 'desig-new',
        departmentId: 'dept-1',
        title: 'Product Manager',
        code: 'PM',
        level: 3,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: newDesig }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await createDesignation({
        departmentId: 'dept-1',
        title: 'Product Manager',
        code: 'PM',
        level: 3,
      });

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = apiFetchSpy.mock.calls[0]!;
      expect(url).toBe('/api/v1/designations');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual({
        departmentId: 'dept-1',
        title: 'Product Manager',
        code: 'PM',
        level: 3,
      });
      expect(result.id).toBe('desig-new');
    });

    it('handles 409 conflict code duplicate error', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DUPLICATE_CODE',
            message: 'A designation with code PM already exists in this department',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(
        createDesignation({
          departmentId: 'dept-1',
          title: 'Product Manager',
          code: 'PM',
          level: 3,
        }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'DUPLICATE_CODE',
      });
    });
  });

  describe('updateDesignation', () => {
    it('sends PUT request with updated designation fields', async () => {
      const updatedDesig: Designation = {
        id: 'desig-1',
        departmentId: 'dept-1',
        title: 'Staff Architect',
        code: 'LEAD_ARCH',
        level: 6,
        isActive: true,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      };

      const mockResponse = new Response(JSON.stringify({ data: updatedDesig }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await updateDesignation('desig-1', {
        title: 'Staff Architect',
        level: 6,
      });

      expect(apiFetchSpy).toHaveBeenCalledWith(
        '/api/v1/designations/desig-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ title: 'Staff Architect', level: 6 }),
        }),
      );
      expect(result.title).toBe('Staff Architect');
      expect(result.level).toBe(6);
    });
  });

  describe('deactivateDesignation', () => {
    it('sends POST request to deactivate endpoint', async () => {
      const mockResponse = new Response(
        JSON.stringify({ data: { id: 'desig-1', isActive: false } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await deactivateDesignation('desig-1');

      expect(apiFetchSpy).toHaveBeenCalledWith('/api/v1/designations/desig-1/deactivate', {
        method: 'POST',
      });
      expect(result.isActive).toBe(false);
    });

    it('rejects with 409 conflict when designation has active employee assignments', async () => {
      const mockResponse = new Response(
        JSON.stringify({
          error: {
            code: 'DESIGNATION_IN_USE',
            message: 'Cannot deactivate designation with active employees',
          },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      await expect(deactivateDesignation('desig-1')).rejects.toMatchObject({
        status: 409,
        code: 'DESIGNATION_IN_USE',
      });
    });
  });

  describe('fetchDepartmentOptions', () => {
    it('fetches departments using pageSize=100 and returns mapped options', async () => {
      const mockDepartments = [
        { id: 'dept-1', name: 'Engineering', code: 'ENG', isActive: true },
        { id: 'dept-2', name: 'Product', code: 'PROD', isActive: true },
      ];

      const mockResponse = new Response(JSON.stringify({ data: mockDepartments }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValue(mockResponse);

      const result = await fetchDepartmentOptions();

      expect(apiFetchSpy).toHaveBeenCalledWith('/api/v1/departments?pageSize=100', undefined);
      expect(result).toHaveLength(2);
      expect(result[0]?.name).toBe('Engineering');
    });

    it('returns empty array when department fetch fails', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockRejectedValue(new Error('Network error'));
      const result = await fetchDepartmentOptions();
      expect(result).toEqual([]);
    });
  });
});
