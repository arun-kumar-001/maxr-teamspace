const CSRF_STORAGE_KEY = 'maxr_csrf_token';

let inMemoryCsrfToken: string | null = (() => {
  if (typeof window !== 'undefined') {
    try {
      return (
        window.sessionStorage?.getItem(CSRF_STORAGE_KEY) ||
        window.localStorage?.getItem(CSRF_STORAGE_KEY) ||
        null
      );
    } catch {
      return null;
    }
  }
  return null;
})();

export function setCsrfToken(token: string | null): void {
  inMemoryCsrfToken = token;
  if (typeof window !== 'undefined') {
    try {
      if (token) {
        window.sessionStorage?.setItem(CSRF_STORAGE_KEY, token);
        window.localStorage?.setItem(CSRF_STORAGE_KEY, token);
      } else {
        window.sessionStorage?.removeItem(CSRF_STORAGE_KEY);
        window.localStorage?.removeItem(CSRF_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  }
}

export function getCsrfToken(): string | null {
  return inMemoryCsrfToken;
}

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let csrfPromise: Promise<string | null> | null = null;

export async function refreshCsrfToken(): Promise<string | null> {
  if (csrfPromise) return csrfPromise;
  csrfPromise = (async () => {
    try {
      const res = await fetch('/api/v1/auth/me', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const json = await res.json();
        const token = json?.data?.csrfToken;
        if (typeof token === 'string' && token.length > 0) {
          setCsrfToken(token);
          return token;
        }
      }
    } catch {
      // ignore
    } finally {
      csrfPromise = null;
    }
    return inMemoryCsrfToken;
  })();
  return csrfPromise;
}

/**
 * Shared API fetch helper for the web app (docs/architecture/auth.md).
 * - Always sends `credentials: 'include'` so HTTP-only session cookies are sent.
 * - Automatically attaches `X-CSRF-Token` from in-memory/sessionStorage on state-changing requests.
 * - Proactively fetches CSRF token if missing, and retries once on 403 CSRF mismatch.
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

  const urlStr =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  const isAuthMe = urlStr.includes('/auth/me');

  if (STATE_CHANGING_METHODS.has(method) && inMemoryCsrfToken) {
    headers.set('X-CSRF-Token', inMemoryCsrfToken);
  }

  let response = await fetch(input, {
    ...init,
    method,
    headers,
    credentials: 'include',
  });

  // If we receive 403 CSRF error on a state-changing request, refresh CSRF and retry once
  if (response.status === 403 && STATE_CHANGING_METHODS.has(method) && !isAuthMe) {
    try {
      const clone = response.clone();
      const json = await clone.json().catch(() => null);
      const isCsrfError =
        json?.error?.message?.toLowerCase().includes('csrf') ||
        json?.error?.code?.toLowerCase().includes('csrf');
      if (isCsrfError) {
        const fresh = await refreshCsrfToken();
        if (fresh) {
          headers.set('X-CSRF-Token', fresh);
          response = await fetch(input, {
            ...init,
            method,
            headers,
            credentials: 'include',
          });
        }
      }
    } catch {
      // Return original response on retry error
    }
  }

  return response;
}
