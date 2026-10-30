let inMemoryCsrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
}

export function getCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Shared API fetch helper for the web app (docs/architecture/auth.md).
 * - Always sends `credentials: 'include'` so HTTP-only session cookies are sent.
 * - Automatically attaches `X-CSRF-Token` from in-memory session on state-changing requests.
 * - Sets default Accept and Content-Type headers for JSON.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (STATE_CHANGING_METHODS.has(method) && inMemoryCsrfToken) {
    headers.set('X-CSRF-Token', inMemoryCsrfToken);
  }

  return fetch(input, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });
}
