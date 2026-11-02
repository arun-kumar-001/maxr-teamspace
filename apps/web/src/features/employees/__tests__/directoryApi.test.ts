import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildDirectoryQueryString,
  fetchEmployeeDirectory,
  fetchDepartments,
  fetchDesignations,
  fetchManagerOptions,
  ApiError,
} from '../api/employees';
import * as clientModule from '../../../api/client';

describe('Employee Directory API: Query Builder & Fetch Functions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildDirectoryQueryString', () => {
    it('returns empty string when no parameters are provided', () => {
      expect(buildDirectoryQueryString({})).toBe('');
    });

    it('strictly omits undefined, null, or empty string values', () => {
      const qs = buildDirectoryQueryString({
        search: '',
        departmentId: '   ',
        designationId: undefined,
        status: undefined,
        managerId: '',
      });
      expect(qs).toBe('');
    });

    it('builds a complete sanitized query string for all active parameters', () => {
      const qs = buildDirectoryQueryString({
        page: 2,
        pageSize: 50,
        sortBy: 'name',
        sortOrder: 'desc',
        search: '  John Doe  ',
        departmentId: '11111111-1111-1111-1111-111111111111',
        designationId: '22222222-2222-2222-2222-222222222222',
        status: 'active',
        managerId: '33333333-3333-3333-3333-333333333333',
      });

      const params = new URLSearchParams(qs);
      expect(params.get('page')).toBe('2');
      expect(params.get('pageSize')).toBe('50');
      expect(params.get('sortBy')).toBe('name');
      expect(params.get('sortOrder')).toBe('desc');
      expect(params.get('search')).toBe('John Doe');
      expect(params.get('departmentId')).toBe('11111111-1111-1111-1111-111111111111');
      expect(params.get('designationId')).toBe('22222222-2222-2222-2222-222222222222');
      expect(params.get('status')).toBe('active');
      expect(params.get('managerId')).toBe('33333333-3333-3333-3333-333333333333');
    });
  });

  describe('fetchEmployeeDirectory', () => {
    it('calls apiFetch with the correct query and returns data and meta', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          employeeCode: 'EMP001',
          firstName: 'Alice',
          lastName: 'Smith',
          email: 'alice@example.com',
          phone: '+1234567890',
          department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'desig-1', title: 'Senior Engineer', code: 'SR_ENG', level: 3 },
          manager: null,
          status: 'active' as const,
          joiningDate: '2025-01-15',
          createdAt: '2025-01-15T00:00:00Z',
          updatedAt: '2025-01-15T00:00:00Z',
        },
      ];

      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: mockEmployees,
          meta: { page: 1, pageSize: 20, total: 1 },
        }),
      } as unknown as Response);

      const result = await fetchEmployeeDirectory({ page: 1, search: 'Alice' });

      expect(clientModule.apiFetch).toHaveBeenCalledWith('/api/v1/employees?page=1&search=Alice');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.employeeCode).toBe('EMP001');
      expect(result.meta.total).toBe(1);
    });

    it('throws ApiError with statusCode 403 when user is forbidden', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'Forbidden: insufficient permissions',
            requestId: 'req-123',
          },
        }),
      } as unknown as Response);

      await expect(fetchEmployeeDirectory()).rejects.toThrow(ApiError);
      try {
        await fetchEmployeeDirectory();
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiError = err as ApiError;
        expect(apiError.statusCode).toBe(403);
        expect(apiError.code).toBe('FORBIDDEN');
        expect(apiError.requestId).toBe('req-123');
      }
    });

    it('handles unexpected non-JSON 500 error gracefully', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as Response);

      await expect(fetchEmployeeDirectory()).rejects.toThrow(ApiError);
    });
  });

  describe('fetchDepartments and fetchDesignations', () => {
    it('fetches and maps departments correctly', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            { id: 'dept-1', name: 'Engineering', code: 'ENG' },
            { id: 'dept-2', name: 'Human Resources', code: 'HR' },
          ],
        }),
      } as unknown as Response);

      const depts = await fetchDepartments();
      expect(depts).toHaveLength(2);
      expect(depts[0]?.name).toBe('Engineering');
    });

    it('returns empty array when departments API fails', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockRejectedValueOnce(new Error('Network failure'));
      const depts = await fetchDepartments();
      expect(depts).toEqual([]);
    });

    it('fetches and maps designations correctly', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: 'desig-1', title: 'Software Engineer', code: 'SWE', level: 2 }],
        }),
      } as unknown as Response);

      const desigs = await fetchDesignations();
      expect(desigs).toHaveLength(1);
      expect(desigs[0]?.title).toBe('Software Engineer');
    });
  });

  describe('fetchManagerOptions', () => {
    it('extracts unique managers from caller scoped employees list and sorts them', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: [
            {
              id: 'emp-1',
              manager: {
                id: 'mgr-2',
                firstName: 'Zara',
                lastName: 'Vance',
                employeeCode: 'MGR002',
              },
            },
            {
              id: 'emp-2',
              manager: {
                id: 'mgr-1',
                firstName: 'Adam',
                lastName: 'Bell',
                employeeCode: 'MGR001',
              },
            },
            {
              id: 'emp-3',
              manager: {
                id: 'mgr-2', // Duplicate manager
                firstName: 'Zara',
                lastName: 'Vance',
                employeeCode: 'MGR002',
              },
            },
            {
              id: 'emp-4',
              manager: null, // No manager
            },
          ],
        }),
      } as unknown as Response);

      const managers = await fetchManagerOptions();
      expect(managers).toHaveLength(2);
      // Sorted by name
      expect(managers[0]?.name).toBe('Adam Bell');
      expect(managers[0]?.id).toBe('mgr-1');
      expect(managers[1]?.name).toBe('Zara Vance');
      expect(managers[1]?.id).toBe('mgr-2');
    });

    it('returns empty array when fetch fails', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as unknown as Response);

      const managers = await fetchManagerOptions();
      expect(managers).toEqual([]);
    });

    it('paginates across multiple pages to discover all managers when total > 100', async () => {
      // Mock page 1 (returns 100 items, total 250, contains Manager Charlie)
      vi.spyOn(clientModule, 'apiFetch')
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'emp-1',
                manager: {
                  id: 'mgr-charlie',
                  firstName: 'Charlie',
                  lastName: 'Day',
                  employeeCode: 'MGR_C',
                },
              },
            ],
            meta: { page: 1, pageSize: 100, total: 250 },
          }),
        } as unknown as Response)
        // Mock page 2 (contains Manager Alice)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'emp-101',
                manager: {
                  id: 'mgr-alice',
                  firstName: 'Alice',
                  lastName: 'Cooper',
                  employeeCode: 'MGR_A',
                },
              },
            ],
            meta: { page: 2, pageSize: 100, total: 250 },
          }),
        } as unknown as Response)
        // Mock page 3 (contains Manager Bob and duplicate Charlie)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'emp-201',
                manager: {
                  id: 'mgr-bob',
                  firstName: 'Bob',
                  lastName: 'Marley',
                  employeeCode: 'MGR_B',
                },
              },
              {
                id: 'emp-202',
                manager: {
                  id: 'mgr-charlie',
                  firstName: 'Charlie',
                  lastName: 'Day',
                  employeeCode: 'MGR_C',
                },
              },
            ],
            meta: { page: 3, pageSize: 100, total: 250 },
          }),
        } as unknown as Response);

      const managers = await fetchManagerOptions();

      // Verified 3 pages were fetched
      expect(clientModule.apiFetch).toHaveBeenCalledTimes(3);
      expect(clientModule.apiFetch).toHaveBeenNthCalledWith(
        1,
        '/api/v1/employees?page=1&pageSize=100',
        { signal: undefined },
      );
      expect(clientModule.apiFetch).toHaveBeenNthCalledWith(
        2,
        '/api/v1/employees?page=2&pageSize=100',
        { signal: undefined },
      );
      expect(clientModule.apiFetch).toHaveBeenNthCalledWith(
        3,
        '/api/v1/employees?page=3&pageSize=100',
        { signal: undefined },
      );

      // Deduplicated to 3 managers and sorted alphabetically
      expect(managers).toHaveLength(3);
      expect(managers[0]?.name).toBe('Alice Cooper');
      expect(managers[1]?.name).toBe('Bob Marley');
      expect(managers[2]?.name).toBe('Charlie Day');
    });

    it('handles more than 1,000 employee records without truncation and discovers managers from later pages', async () => {
      // Simulate 1,250 total employees across 13 pages (each page has 100 items)
      // Manager on Page 1: "Devon Miles"
      // Manager on Page 11 (>1,000 employees mark): "Zane Taylor"
      // Manager on Page 13 (last page): "Arthur Dent"
      const totalEmployees = 1250;

      const pageMocks: Record<
        number,
        Array<{
          id: string;
          manager: { id: string; firstName: string; lastName: string; employeeCode: string };
        }>
      > = {
        1: [
          {
            id: 'emp-1',
            manager: {
              id: 'mgr-devon',
              firstName: 'Devon',
              lastName: 'Miles',
              employeeCode: 'MGR_DEV',
            },
          },
        ],
        11: [
          {
            id: 'emp-1001',
            manager: {
              id: 'mgr-zane',
              firstName: 'Zane',
              lastName: 'Taylor',
              employeeCode: 'MGR_ZAN',
            },
          },
        ],
        13: [
          {
            id: 'emp-1201',
            manager: {
              id: 'mgr-arthur',
              firstName: 'Arthur',
              lastName: 'Dent',
              employeeCode: 'MGR_ART',
            },
          },
        ],
      };

      vi.spyOn(clientModule, 'apiFetch').mockImplementation(async (input: RequestInfo | URL) => {
        const url = String(input);
        const urlObj = new URL(url, 'http://localhost');
        const pageNum = parseInt(urlObj.searchParams.get('page') || '1', 10);
        const data = pageMocks[pageNum] ?? [];

        return {
          ok: true,
          status: 200,
          json: async () => ({
            data,
            meta: { page: pageNum, pageSize: 100, total: totalEmployees },
          }),
        } as unknown as Response;
      });

      const managers = await fetchManagerOptions();

      // Verified: all 13 pages were fetched without silent truncation at 1,000
      expect(clientModule.apiFetch).toHaveBeenCalledTimes(13);

      // Verified: Managers on page 11 and page 13 are fully discovered and sorted alphabetically
      expect(managers).toHaveLength(3);
      expect(managers[0]?.name).toBe('Arthur Dent');
      expect(managers[0]?.id).toBe('mgr-arthur');
      expect(managers[1]?.name).toBe('Devon Miles');
      expect(managers[1]?.id).toBe('mgr-devon');
      expect(managers[2]?.name).toBe('Zane Taylor');
      expect(managers[2]?.id).toBe('mgr-zane');
    });

    it('respects AbortSignal cancellation during manager discovery', async () => {
      const controller = new AbortController();

      vi.spyOn(clientModule, 'apiFetch').mockImplementation(async (_input: RequestInfo | URL) => {
        // Abort after first page
        controller.abort();
        return {
          ok: true,
          status: 200,
          json: async () => ({
            data: [
              {
                id: 'emp-1',
                manager: {
                  id: 'mgr-1',
                  firstName: 'Abby',
                  lastName: 'Road',
                  employeeCode: 'MGR_1',
                },
              },
            ],
            meta: { page: 1, pageSize: 100, total: 500 },
          }),
        } as unknown as Response;
      });

      const managers = await fetchManagerOptions(controller.signal);

      // Only first page was called; subsequent batch was aborted
      expect(clientModule.apiFetch).toHaveBeenCalledTimes(1);
      expect(managers).toHaveLength(1);
      expect(managers[0]?.name).toBe('Abby Road');
    });
  });
});
