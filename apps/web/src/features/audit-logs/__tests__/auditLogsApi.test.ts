import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as client from '../../../api/client';
import {
  buildAuditLogQueryString,
  getAuditLogs,
  getBasicSettings,
  AuditLogsApiError,
} from '../api/auditLogsApi';
import type { AuditLogQuery } from '../types';

describe('auditLogsApi Suite (Issue #28)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildAuditLogQueryString', () => {
    it('builds query with standard pagination and default sortOrder', () => {
      const query: AuditLogQuery = {
        page: 1,
        pageSize: 50,
        sortOrder: 'desc',
      };
      const qs = buildAuditLogQueryString(query);
      expect(qs).toBe('?page=1&pageSize=50&sortOrder=desc');
    });

    it('handles filters correctly', () => {
      const query: AuditLogQuery = {
        page: 2,
        pageSize: 20,
        sortOrder: 'asc',
        module: 'leave',
        outcome: 'success',
        entityType: 'leave_request',
        entityId: 'req-123',
        actorId: '123e4567-e89b-12d3-a456-426614174000',
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-31T23:59:59Z',
      };
      const qs = buildAuditLogQueryString(query);
      expect(qs).toContain('page=2');
      expect(qs).toContain('pageSize=20');
      expect(qs).toContain('sortOrder=asc');
      expect(qs).toContain('module=leave');
      expect(qs).toContain('outcome=success');
      expect(qs).toContain('entityType=leave_request');
      expect(qs).toContain('entityId=req-123');
      expect(qs).toContain('actorId=123e4567-e89b-12d3-a456-426614174000');
      expect(qs).toContain('from=2026-10-01T00%3A00%3A00Z');
      expect(qs).toContain('to=2026-10-31T23%3A59%3A59Z');
    });

    it('prioritizes action over module when both are provided to avoid backend 400', () => {
      const query: AuditLogQuery = {
        page: 1,
        pageSize: 50,
        sortOrder: 'desc',
        action: 'leave.approve',
        module: 'leave',
      };
      const qs = buildAuditLogQueryString(query);
      expect(qs).toContain('action=leave.approve');
      expect(qs).not.toContain('module=');
    });

    it('ignores empty/whitespace string filters', () => {
      const query: AuditLogQuery = {
        page: 1,
        pageSize: 50,
        sortOrder: 'desc',
        action: '   ',
        entityType: '',
        actorId: '   ',
      };
      const qs = buildAuditLogQueryString(query);
      expect(qs).toBe('?page=1&pageSize=50&sortOrder=desc');
    });
  });

  describe('getAuditLogs', () => {
    it('returns audit log list response on success', async () => {
      const mockData = {
        data: [
          {
            id: 'log-1',
            occurredAt: '2026-11-01T10:00:00Z',
            action: 'auth.login',
            outcome: 'success',
            actor: { id: 'u-1', name: 'Eleanor Vance', role: 'admin' },
            entityType: 'user',
            entityId: 'u-1',
            requestId: 'req-1',
            changes: null,
            metadata: { ip: '127.0.0.1' },
          },
        ],
        meta: {
          page: 1,
          pageSize: 50,
          total: 1,
        },
      };

      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      } as Response);

      const res = await getAuditLogs({ page: 1, pageSize: 50, sortOrder: 'desc' });
      expect(res.data).toHaveLength(1);
      expect(res.data[0]!.action).toBe('auth.login');
      expect(res.meta.total).toBe(1);
    });

    it('throws AuditLogsApiError when API returns error', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: 'FORBIDDEN',
            message: 'Admin access required',
          },
        }),
      } as Response);

      await expect(getAuditLogs({ page: 1, pageSize: 50, sortOrder: 'desc' })).rejects.toThrow(
        AuditLogsApiError,
      );
    });
  });

  describe('getBasicSettings', () => {
    it('returns basic settings on success', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            companyName: 'MAXR Global',
            timezone: 'Asia/Kolkata',
          },
        }),
      } as Response);

      const settings = await getBasicSettings();
      expect(settings).not.toBeNull();
      expect(settings?.timezone).toBe('Asia/Kolkata');
    });

    it('returns null on failure', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValue({
        ok: false,
        status: 500,
      } as Response);

      const settings = await getBasicSettings();
      expect(settings).toBeNull();
    });
  });
});
