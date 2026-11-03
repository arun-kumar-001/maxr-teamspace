import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as client from '../../../api/client';
import {
  ExpensesApiError,
  buildQueryParams,
  cancelClaim,
  getClaim,
  getReceiptDownloadLink,
  listCategories,
  listClaims,
  listMyClaims,
  reimburseClaim,
  submitClaim,
} from '../api/expensesApi';

describe('expensesApi', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('buildQueryParams', () => {
    it('returns empty string when no params provided', () => {
      expect(buildQueryParams()).toBe('');
      expect(buildQueryParams({})).toBe('');
    });

    it('builds full query string with all filters', () => {
      const qs = buildQueryParams({
        page: 2,
        pageSize: 10,
        status: 'approved',
        categoryId: '50000000-0000-4000-a000-000000000001',
        employeeId: '60000000-0000-4000-a000-000000000001',
        from: '2026-10-01',
        to: '2026-10-31',
      });
      expect(qs).toContain('page=2');
      expect(qs).toContain('pageSize=10');
      expect(qs).toContain('status=approved');
      expect(qs).toContain('categoryId=50000000-0000-4000-a000-000000000001');
      expect(qs).toContain('employeeId=60000000-0000-4000-a000-000000000001');
      expect(qs).toContain('from=2026-10-01');
      expect(qs).toContain('to=2026-10-31');
    });
  });

  describe('API Calls', () => {
    it('listCategories returns categories array', async () => {
      const mockCategories = [{ id: 'cat-1', name: 'Travel', isActive: true }];
      vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCategories }),
      } as Response);

      const res = await listCategories();
      expect(res).toEqual(mockCategories);
    });

    it('listClaims passes query params and returns paginated result', async () => {
      const mockResult = {
        data: [{ id: 'claim-1', amountPaise: 5000 }],
        meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
      };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const res = await listClaims({ page: 1, status: 'submitted' });
      expect(res).toEqual(mockResult);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/expense-claims?page=1&status=submitted'),
      );
    });

    it('listMyClaims calls /expense-claims/mine', async () => {
      const mockResult = {
        data: [],
        meta: { page: 1, pageSize: 20, total: 0, pageCount: 0 },
      };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
      } as Response);

      const res = await listMyClaims({ page: 1 });
      expect(res).toEqual(mockResult);
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/expense-claims/mine?page=1'),
      );
    });

    it('getClaim fetches a single claim by id', async () => {
      const mockClaim = { id: 'c-1', description: 'Lunch' };
      vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockClaim }),
      } as Response);

      const res = await getClaim('c-1');
      expect(res).toEqual(mockClaim);
    });

    it('submitClaim sends POST request with JSON payload', async () => {
      const payload = {
        categoryId: '50000000-0000-4000-a000-000000000001',
        amountPaise: 5000,
        expenseDate: '2026-11-01',
        description: 'Office stationery',
      };
      const mockCreated = { id: 'c-new', ...payload, status: 'submitted' };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCreated }),
      } as Response);

      const res = await submitClaim(payload);
      expect(res).toEqual(mockCreated);
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/expense-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    });

    it('cancelClaim sends POST request to cancel endpoint', async () => {
      const mockCancelled = { id: 'c-1', status: 'cancelled' };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockCancelled }),
      } as Response);

      const res = await cancelClaim('c-1');
      expect(res).toEqual(mockCancelled);
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/expense-claims/c-1/cancel', {
        method: 'POST',
      });
    });

    it('reimburseClaim sends POST request to reimburse endpoint', async () => {
      const mockReimbursed = { id: 'c-1', status: 'reimbursed' };
      const fetchSpy = vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockReimbursed }),
      } as Response);

      const res = await reimburseClaim('c-1');
      expect(res).toEqual(mockReimbursed);
      expect(fetchSpy).toHaveBeenCalledWith('/api/v1/expense-claims/c-1/reimburse', {
        method: 'POST',
      });
    });

    it('getReceiptDownloadLink returns signed url', async () => {
      const mockLink = { url: '/files/receipt-123', expiresAt: '2026-11-03T11:00:00Z' };
      vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLink }),
      } as Response);

      const res = await getReceiptDownloadLink('c-1');
      expect(res).toEqual(mockLink);
    });

    it('throws ExpensesApiError on error response with details', async () => {
      vi.spyOn(client, 'apiFetch').mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          error: {
            code: 'UNPROCESSABLE_ENTITY',
            message: 'Receipt is required for claims over ₹200.00',
            requestId: 'req-123',
          },
        }),
      } as Response);

      await expect(
        submitClaim({
          categoryId: 'cat-1',
          amountPaise: 50000,
          expenseDate: '2026-11-01',
          description: 'No receipt',
        }),
      ).rejects.toThrowError(ExpensesApiError);
    });
  });
});

