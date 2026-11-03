import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as clientModule from '../../../api/client';
import {
  fetchProfile,
  ProfileApiError,
  updateProfilePhone,
  validatePhoneInput,
} from '../api/profileApi';
import type { EmployeeProfile } from '../types';

describe('Profile API Client & Payload Security Suite (Issue #22)', () => {
  const mockProfile: EmployeeProfile = {
    id: 'emp-100',
    employeeCode: 'EMP-001',
    firstName: 'Asha',
    lastName: 'Rao',
    email: 'asha@example.com',
    phone: '+91 98765 43210',
    department: { id: 'dept-1', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-1', title: 'Senior Engineer', code: 'ENG-SR' },
    manager: {
      id: 'emp-099',
      firstName: 'Rahul',
      lastName: 'Dravid',
      employeeCode: 'MGR-001',
    },
    status: 'active',
    joiningDate: '2025-01-15',
    createdAt: '2025-01-15T00:00:00.000Z',
    updatedAt: '2025-01-15T00:00:00.000Z',
    version: 3,
    account: {
      userId: 'usr-100',
      isActive: true,
      lastLoginAt: '2026-10-30T10:00:00.000Z',
      roles: ['staff'],
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchProfile (GET /api/v1/employees/me)', () => {
    it('requests the exact canonical endpoint GET /api/v1/employees/me without employee ID', async () => {
      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockProfile }),
      } as unknown as Response);

      const result = await fetchProfile();

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      const [endpoint, init] = apiFetchSpy.mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe('/api/v1/employees/me');
      expect(init?.method).toBe('GET');
      expect(result).toEqual(mockProfile);
    });

    it('propagates abort signal to the fetch call', async () => {
      const controller = new AbortController();
      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockProfile }),
      } as unknown as Response);

      await fetchProfile(controller.signal);

      const [, init] = apiFetchSpy.mock.calls[0] as [string, RequestInit];
      expect(init?.signal).toBe(controller.signal);
    });

    it('maps API error envelopes with code, message, and status', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'AUTH_REQUIRED',
            message: 'Session is required',
            requestId: 'req-401',
          },
        }),
      } as unknown as Response);

      await expect(fetchProfile()).rejects.toThrow(ProfileApiError);
      try {
        await fetchProfile();
      } catch (err) {
        if (err instanceof ProfileApiError) {
          expect(err.status).toBe(401);
          expect(err.code).toBe('AUTH_REQUIRED');
          expect(err.message).toBe('Session is required');
        }
      }
    });
  });

  describe('updateProfilePhone (PUT /api/v1/employees/me)', () => {
    it('updates phone number with correct version and strict payload', async () => {
      const updatedProfile: EmployeeProfile = {
        ...mockProfile,
        phone: '+91 99999 99999',
        version: 4,
      };

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: updatedProfile }),
      } as unknown as Response);

      const result = await updateProfilePhone({
        version: 3,
        phone: '+91 99999 99999',
      });

      expect(apiFetchSpy).toHaveBeenCalledTimes(1);
      const [endpoint, init] = apiFetchSpy.mock.calls[0] as [string, RequestInit];
      expect(endpoint).toBe('/api/v1/employees/me');
      expect(init?.method).toBe('PUT');

      // Assert payload strictly contains only version and phone
      const sentBody = JSON.parse(init?.body as string);
      expect(sentBody).toEqual({
        version: 3,
        phone: '+91 99999 99999',
      });
      expect(result).toEqual(updatedProfile);
    });

    it('clears phone number when given null or empty string', async () => {
      const clearedProfile: EmployeeProfile = {
        ...mockProfile,
        phone: null,
        version: 4,
      };

      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: clearedProfile }),
      } as unknown as Response);

      const result = await updateProfilePhone({
        version: 3,
        phone: null,
      });

      const [, init] = apiFetchSpy.mock.calls[0] as [string, RequestInit];
      const sentBody = JSON.parse(init?.body as string);
      expect(sentBody).toEqual({
        version: 3,
        phone: null,
      });
      expect(result.phone).toBeNull();
    });

    it('SECURITY REQUIREMENT: strictly prevents transmission of any non-phone employee fields', async () => {
      const apiFetchSpy = vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ data: mockProfile }),
      } as unknown as Response);

      // Malicious attempt to pass extra fields into updateProfilePhone
      const dirtyPayload = {
        version: 3,
        phone: '+91 98888 88888',
        role: 'admin',
        roles: ['admin'],
        status: 'active',
        employeeCode: 'HACK-001',
        email: 'hacker@example.com',
        firstName: 'Mallory',
        departmentId: 'dept-hack',
        designationId: 'desig-hack',
        managerId: 'mgr-hack',
        employeeId: 'emp-hack',
        userId: 'usr-hack',
      };

      await updateProfilePhone(dirtyPayload as unknown as { version: number; phone: string });

      const [, init] = apiFetchSpy.mock.calls[0] as [string, RequestInit];
      const sentBody = JSON.parse(init?.body as string);

      // Verify STRICT payload keys
      expect(Object.keys(sentBody).sort()).toEqual(['phone', 'version']);
      expect(sentBody.version).toBe(3);
      expect(sentBody.phone).toBe('+91 98888 88888');

      // Specifically verify forbidden keys are absent
      expect(sentBody.role).toBeUndefined();
      expect(sentBody.roles).toBeUndefined();
      expect(sentBody.status).toBeUndefined();
      expect(sentBody.employeeCode).toBeUndefined();
      expect(sentBody.email).toBeUndefined();
      expect(sentBody.firstName).toBeUndefined();
      expect(sentBody.departmentId).toBeUndefined();
      expect(sentBody.designationId).toBeUndefined();
      expect(sentBody.managerId).toBeUndefined();
      expect(sentBody.employeeId).toBeUndefined();
      expect(sentBody.userId).toBeUndefined();
    });

    it('handles HTTP 409 conflict when version is stale', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 409,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'VERSION_CONFLICT',
            message: 'The employee profile was modified by another request.',
          },
        }),
      } as unknown as Response);

      await expect(
        updateProfilePhone({ version: 1, phone: '+91 98888 88888' }),
      ).rejects.toMatchObject({
        status: 409,
        code: 'VERSION_CONFLICT',
      });
    });

    it('handles HTTP 422 when employee is deactivated', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'EMPLOYEE_DEACTIVATED',
            message: 'Employee is deactivated and cannot be modified.',
          },
        }),
      } as unknown as Response);

      await expect(
        updateProfilePhone({ version: 2, phone: '+91 98888 88888' }),
      ).rejects.toMatchObject({
        status: 422,
        code: 'EMPLOYEE_DEACTIVATED',
      });
    });

    it('handles HTTP 400 validation error for invalid phone syntax', async () => {
      vi.spyOn(clientModule, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Digits, spaces, + ( ) and - only',
          },
        }),
      } as unknown as Response);

      await expect(
        updateProfilePhone({ version: 2, phone: 'invalid-alpha-phone' }),
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('validatePhoneInput client-side validation', () => {
    it('accepts null, undefined, and empty string (which clears phone)', () => {
      expect(validatePhoneInput(null).isValid).toBe(true);
      expect(validatePhoneInput(undefined).isValid).toBe(true);
      expect(validatePhoneInput('').isValid).toBe(true);
      expect(validatePhoneInput('   ').isValid).toBe(true);
    });

    it('accepts valid phone numbers conforming to the backend schema', () => {
      expect(validatePhoneInput('+91 98765 43210').isValid).toBe(true);
      expect(validatePhoneInput('(080) 2345-6789').isValid).toBe(true);
      expect(validatePhoneInput('+1-555-123-4567').isValid).toBe(true);
      expect(validatePhoneInput('123456').isValid).toBe(true);
    });

    it('rejects invalid characters, letters, and numbers that are too short/long', () => {
      expect(validatePhoneInput('123').isValid).toBe(false); // too short
      expect(validatePhoneInput('call me').isValid).toBe(false); // letters
      expect(validatePhoneInput('+91 98765 43210 #123').isValid).toBe(false); // invalid symbol #
      expect(validatePhoneInput('a'.repeat(55)).isValid).toBe(false); // too long
    });
  });
});
