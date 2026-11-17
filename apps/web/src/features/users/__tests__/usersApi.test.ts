// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as client from '../../../api/client';
import {
  createUser,
  getPermissions,
  getRoles,
  getUser,
  getUsers,
  updateUserRoles,
  updateUserStatus,
} from '../api/usersApi';
import type { UserAccount } from '../types';

describe('Users API Client (Issue #27)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockUser: UserAccount = {
    id: 'u-1',
    employeeId: 'emp-1',
    employeeCode: 'MAX001',
    name: 'Admin User',
    email: 'admin@maxr.internal',
    isActive: true,
    roles: ['admin'],
    lastLoginAt: '2026-11-01T12:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
  };

  describe('getUsers', () => {
    it('calls GET /api/v1/users with proper query parameters', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [mockUser],
          meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
        }),
      } as unknown as Response);

      const result = await getUsers({
        search: 'Admin',
        role: 'admin',
        isActive: true,
        page: 1,
        pageSize: 10,
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users?page=1&pageSize=10&search=Admin&role=admin&isActive=true&sortBy=name&sortOrder=asc',
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe('u-1');
    });

    it('throws UsersApiError when backend returns non-ok response', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: { message: 'Forbidden access to users list', code: 'FORBIDDEN' },
        }),
      } as unknown as Response);

      await expect(getUsers()).rejects.toThrow('Forbidden access to users list');
    });
  });

  describe('getUser', () => {
    it('fetches single user by id', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUser }),
      } as unknown as Response);

      const result = await getUser('u-1');
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/users/u-1');
      expect(result.name).toBe('Admin User');
    });

    it('throws UsersApiError on 404', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'User not found' } }),
      } as unknown as Response);

      await expect(getUser('unknown')).rejects.toThrow('User not found');
    });
  });

  describe('updateUserRoles', () => {
    it('calls PUT /api/v1/users/:id/roles with role array', async () => {
      const updatedUser: UserAccount = {
        ...mockUser,
        roles: ['admin', 'hr_manager'],
      };

      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedUser }),
      } as unknown as Response);

      const result = await updateUserRoles('u-1', ['admin', 'hr_manager']);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/u-1/roles',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ roles: ['admin', 'hr_manager'] }),
        }),
      );
      expect(result.roles).toEqual(['admin', 'hr_manager']);
    });

    it('throws 422 when attempting to remove the last active Admin', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            message: 'The last active Admin cannot lose the Admin role',
            code: 'UNPROCESSABLE_ENTITY',
          },
        }),
      } as unknown as Response);

      await expect(updateUserRoles('u-1', ['staff'])).rejects.toThrow(
        'The last active Admin cannot lose the Admin role',
      );
    });
  });

  describe('getRoles', () => {
    it('calls GET /api/v1/roles and returns role summaries', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            { id: 'r-1', key: 'admin', name: 'Admin', description: 'Admin desc', activeUsers: 2 },
          ],
        }),
      } as unknown as Response);

      const result = await getRoles();
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/roles');
      expect(result).toHaveLength(1);
      expect(result[0]?.activeUsers).toBe(2);
    });
  });

  describe('getPermissions', () => {
    it('calls GET /api/v1/permissions and returns catalog', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [
            {
              key: 'users.list',
              module: 'users',
              action: 'list',
              description: 'List user accounts',
              grants: { admin: 'company', hr_manager: 'company' },
            },
          ],
        }),
      } as unknown as Response);

      const result = await getPermissions();
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/permissions');
      expect(result).toHaveLength(1);
      expect(result[0]?.key).toBe('users.list');
    });
  });

  describe('createUser', () => {
    it('calls POST /api/v1/users and returns user plus optional temporaryPassword', async () => {
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({
          data: mockUser,
          meta: { temporaryPassword: 'Temp#Password1' },
        }),
      } as unknown as Response);

      const result = await createUser({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@maxr.internal',
        roles: ['admin'],
        isActive: true,
      });

      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users',
        expect.objectContaining({
          method: 'POST',
        }),
      );
      expect(result.user.id).toBe('u-1');
      expect(result.temporaryPassword).toBe('Temp#Password1');
    });
  });

  describe('updateUserStatus', () => {
    it('calls PUT /api/v1/users/:id/status with isActive boolean', async () => {
      const deactivated: UserAccount = { ...mockUser, isActive: false };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        json: async () => ({ data: deactivated }),
      } as unknown as Response);

      const result = await updateUserStatus('u-1', false);
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/users/u-1/status',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ isActive: false }),
        }),
      );
      expect(result.isActive).toBe(false);
    });
  });
});
