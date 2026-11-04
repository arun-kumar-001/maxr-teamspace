import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import {
  changeEmployeeManager,
  fetchDirectReports,
  fetchOrgRoots,
  HierarchyApiError,
} from '../api/hierarchy';
import type { OrgNode } from '../types';

describe('Hierarchy API (Issue #23)', () => {
  const mockRoots: OrgNode[] = [
    {
      id: 'emp-root-1',
      employeeCode: 'CEO-001',
      name: 'Arun Kumar',
      designation: 'Managing Director',
      status: 'active',
      directReportCount: 3,
    },
    {
      id: 'emp-root-2',
      employeeCode: 'CTO-001',
      name: 'Divya Sharma',
      designation: 'Chief Technology Officer',
      status: 'active',
      directReportCount: 2,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchOrgRoots', () => {
    it('fetches top-level organization roots with query params', async () => {
      let requestedUrl = '';
      vi.spyOn(client, 'apiFetch').mockImplementation(async (url) => {
        requestedUrl = String(url);
        return new Response(
          JSON.stringify({
            data: mockRoots,
            meta: { page: 1, pageSize: 50, total: 2 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const res = await fetchOrgRoots({ status: 'active', page: 1, pageSize: 50 });

      expect(requestedUrl).toContain('/api/v1/employees/org-roots');
      expect(requestedUrl).toContain('status=active');
      expect(requestedUrl).toContain('page=1');
      expect(requestedUrl).toContain('pageSize=50');
      expect(res.data).toHaveLength(2);
      expect(res.data[0]?.name).toBe('Arun Kumar');
      expect(res.data[0]?.directReportCount).toBe(3);
    });

    it('throws HierarchyApiError when server returns 403 Forbidden', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'FORBIDDEN', message: 'You are not allowed to list organization roots' },
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(fetchOrgRoots()).rejects.toThrowError(HierarchyApiError);
      try {
        await fetchOrgRoots();
      } catch (err) {
        expect(err).toBeInstanceOf(HierarchyApiError);
        const hierarchyErr = err as HierarchyApiError;
        expect(hierarchyErr.status).toBe(403);
        expect(hierarchyErr.isForbidden).toBe(true);
      }
    });
  });

  describe('fetchDirectReports', () => {
    it('fetches direct reports for an employee', async () => {
      let requestedUrl = '';
      vi.spyOn(client, 'apiFetch').mockImplementation(async (url) => {
        requestedUrl = String(url);
        return new Response(
          JSON.stringify({
            data: [
              {
                id: 'emp-child-1',
                employeeCode: 'ENG-002',
                name: 'Kavita Iyer',
                designation: 'Senior Lead Engineer',
                status: 'active',
                directReportCount: 0,
              },
            ],
            meta: { page: 1, pageSize: 50, total: 1 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const res = await fetchDirectReports('emp-root-1', { status: 'active' });

      expect(requestedUrl).toContain('/api/v1/employees/emp-root-1/direct-reports');
      expect(res.data).toHaveLength(1);
      expect(res.data[0]?.name).toBe('Kavita Iyer');
      expect(res.data[0]?.directReportCount).toBe(0);
    });

    it('handles 404 when employee does not exist or is out of caller scope', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { code: 'NOT_FOUND', message: 'Employee not found' },
          }),
          { status: 404, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      await expect(fetchDirectReports('unknown-id')).rejects.toThrowError(HierarchyApiError);
      try {
        await fetchDirectReports('unknown-id');
      } catch (err) {
        expect(err).toBeInstanceOf(HierarchyApiError);
        const hierarchyErr = err as HierarchyApiError;
        expect(hierarchyErr.isNotFound).toBe(true);
      }
    });
  });

  describe('changeEmployeeManager', () => {
    it('successfully changes employee manager and sends PUT body', async () => {
      let capturedBody: unknown = null;
      let capturedMethod = '';

      vi.spyOn(client, 'apiFetch').mockImplementation(async (_url, init) => {
        capturedMethod = init?.method || '';
        capturedBody = JSON.parse(String(init?.body || '{}'));
        return new Response(
          JSON.stringify({
            data: {
              id: 'emp-target',
              managerId: 'emp-new-mgr',
              manager: { id: 'emp-new-mgr', employeeCode: 'MGR-002', name: 'Divya Sharma' },
              version: 2,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      });

      const result = await changeEmployeeManager('emp-target', {
        version: 1,
        managerId: 'emp-new-mgr',
      });

      expect(capturedMethod).toBe('PUT');
      expect(capturedBody).toEqual({ version: 1, managerId: 'emp-new-mgr' });
      expect(result.id).toBe('emp-target');
      expect(result.version).toBe(2);
      expect(result.manager?.name).toBe('Divya Sharma');
    });

    it('correctly detects 422 cycle error', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'CYCLE_DETECTED',
              message: 'Manager reports to employee or creates a cycle',
            },
          }),
          { status: 422, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await changeEmployeeManager('emp-1', { version: 1, managerId: 'emp-2' });
        expect.unreachable('Should have thrown 422');
      } catch (err) {
        expect(err).toBeInstanceOf(HierarchyApiError);
        const hierarchyErr = err as HierarchyApiError;
        expect(hierarchyErr.status).toBe(422);
        expect(hierarchyErr.isCycleOrUnprocessable).toBe(true);
        expect(hierarchyErr.message).toBe('Manager reports to employee or creates a cycle');
      }
    });

    it('correctly detects 409 optimistic locking conflict', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue(
        new Response(
          JSON.stringify({
            error: {
              code: 'STALE_VERSION',
              message: 'Employee version mismatch (expected 1, found 2)',
            },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      try {
        await changeEmployeeManager('emp-1', { version: 1, managerId: 'emp-2' });
        expect.unreachable('Should have thrown 409');
      } catch (err) {
        expect(err).toBeInstanceOf(HierarchyApiError);
        const hierarchyErr = err as HierarchyApiError;
        expect(hierarchyErr.status).toBe(409);
        expect(hierarchyErr.isConflict).toBe(true);
      }
    });
  });
});
