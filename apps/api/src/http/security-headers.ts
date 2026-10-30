import { RequestHandler } from 'express';

export interface SecurityHeadersOptions {
  /** Send Strict-Transport-Security. Only when the API is reached over HTTPS (production). */
  hsts: boolean;
}

/**
 * Defence in depth for an API that returns JSON only. Nginx sets the full policy for the web
 * app at the edge (deploy/nginx/security-headers.conf); these keep the API safe when it is
 * reached without Nginx (local development, a misrouted request).
 *
 * `Cache-Control: no-store` is the default for every response because API data is personal;
 * a route can override it (signed file downloads send `private, no-store`).
 */
export function securityHeaders({ hsts }: SecurityHeadersOptions): RequestHandler {
  return (_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    if (hsts) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}
