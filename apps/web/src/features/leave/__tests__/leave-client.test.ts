import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCsrfToken } from '../../../api/client';
import { applyForLeave, fetchLeaveApprovalRoute } from '../api/leave';

afterEach(() => {
  setCsrfToken(null);
  vi.unstubAllGlobals();
});

describe('manual leave approver API client', () => {
  it('sends the chosen role with the session, CSRF token and an idempotency key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: 'request-1' } }), { status: 201 }),
      );
    vi.stubGlobal('fetch', fetchMock);
    setCsrfToken('test-csrf');
    const payload = {
      leaveTypeId: 'policy-1',
      startDate: '2026-12-01',
      endDate: '2026-12-01',
      approverRole: 'team_lead' as const,
    };
    expect(await applyForLeave(payload)).toEqual({ id: 'request-1' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/leave-requests');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body as string)).toEqual(payload);
    const headers = new Headers(init.headers);
    expect(headers.get('X-CSRF-Token')).toBe('test-csrf');
    expect(headers.get('Idempotency-Key')).toMatch(/^[a-z0-9-]{36}$/i);
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('propagates a rejected approver instead of reporting success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: { message: 'Choose an available leave approver', code: 'UNPROCESSABLE' },
          }),
          { status: 422 },
        ),
      ),
    );
    await expect(
      applyForLeave({
        leaveTypeId: 'policy-1',
        startDate: '2026-12-01',
        endDate: '2026-12-01',
        approverRole: 'team_lead',
      }),
    ).rejects.toMatchObject({ status: 422, message: 'Choose an available leave approver' });
  });

  it('fetches available choices for the signed-in employee with abort support', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: { approverRoles: ['admin'] } })));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    expect(await fetchLeaveApprovalRoute(controller.signal)).toEqual({ approverRoles: ['admin'] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/leave-requests/approval-route',
      expect.objectContaining({ credentials: 'include', signal: controller.signal }),
    );
  });
});
