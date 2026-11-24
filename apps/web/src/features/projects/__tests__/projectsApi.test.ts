// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '../../../api/client';
import { createProject, newIdempotencyKey } from '../api/projectsApi';

vi.mock('../../../api/client', () => ({ apiFetch: vi.fn() }));

// The server accepts 8 to 128 letters, digits, "-" and "_" (apps/api/src/http/idempotency.ts).
const SERVER_KEY = /^[A-Za-z0-9_-]{8,128}$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('projects API client: create', () => {
  beforeEach(() => {
    vi.mocked(apiFetch).mockReset();
  });

  it('sends an Idempotency-Key the server accepts: without one the API answers "Request validation failed"', async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(201, { data: { id: 'p1' } }));
    await createProject({ code: 'MAXR-002', name: 'MaxR Teamspace' });

    const [url, init] = vi.mocked(apiFetch).mock.calls[0]!;
    expect(url).toBe('/api/v1/projects');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toMatch(SERVER_KEY);
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('uses the key it is given, so a retry of the same form is the same request', async () => {
    vi.mocked(apiFetch).mockResolvedValue(json(201, { data: { id: 'p1' } }));
    await createProject({ code: 'MAXR-002', name: 'A' }, 'retry-key-12345678');
    const headers = (vi.mocked(apiFetch).mock.calls[0]![1] as RequestInit).headers as Record<
      string,
      string
    >;
    expect(headers['Idempotency-Key']).toBe('retry-key-12345678');
  });

  it('makes a different key each time when none is given', () => {
    const keys = new Set(Array.from({ length: 20 }, () => newIdempotencyKey()));
    expect(keys.size).toBe(20);
    for (const key of keys) expect(key).toMatch(SERVER_KEY);
  });

  it('says what the server found wrong instead of only "Request validation failed"', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      json(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: [
            { field: 'body.code', message: 'Letters, digits, - and _, starting with a letter' },
            { field: 'header.Idempotency-Key', message: 'This header is required' },
          ],
        },
      }),
    );
    await expect(createProject({ code: '1', name: 'A' })).rejects.toThrow(
      'Request validation failed (body.code: Letters, digits, - and _, starting with a letter; header.Idempotency-Key: This header is required)',
    );
  });

  it('keeps the plain message when the server sends no details, and the status on the error', async () => {
    vi.mocked(apiFetch).mockResolvedValue(
      json(409, {
        error: { code: 'CONFLICT', message: 'A project with this code already exists' },
      }),
    );
    await expect(createProject({ code: 'MAXR-002', name: 'A' })).rejects.toMatchObject({
      message: 'A project with this code already exists',
      status: 409,
    });
  });
});
