/**
 * CORS_ORIGIN is exactly one web origin (scheme, host, optional port; no path, no wildcard).
 * Cookies are sent cross-origin, so a wildcard would be a hole, and the CSRF Origin check in
 * the auth module compares against this same value.
 */
export function parseCorsOrigin(raw: string, nodeEnv: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `[Config Error] CORS_ORIGIN must be a single origin such as https://app.example.com`,
    );
  }
  if (raw === '*' || url.origin === 'null' || !['http:', 'https:'].includes(url.protocol)) {
    throw new Error('[Config Error] CORS_ORIGIN must be an http(s) origin, never a wildcard.');
  }
  if (raw !== url.origin) {
    throw new Error(
      `[Config Error] CORS_ORIGIN must be an origin without a path or trailing slash (expected ${url.origin}).`,
    );
  }
  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw new Error('[Config Error] CORS_ORIGIN must use https in production.');
  }
  return url.origin;
}
