import { describe, expect, it } from 'vitest';
import { isAllowedOrigin } from './authenticate';

const SITE = 'https://teamspace.maxr.in';

describe('isAllowedOrigin', () => {
  it('accepts the configured origin, or any entry of a comma-separated list', () => {
    expect(isAllowedOrigin(SITE, SITE, 'production')).toBe(true);
    expect(isAllowedOrigin('https://b.example', `${SITE}, https://b.example`, 'production')).toBe(
      true,
    );
  });

  it('accepts a request with no Origin header', () => {
    expect(isAllowedOrigin(undefined, SITE, 'production')).toBe(true);
  });

  it.each([
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://abc-def.ngrok-free.dev',
    'https://abc.ngrok.io',
    'https://abc.localtunnel.me',
  ])('accepts the development origin %s outside production', (origin) => {
    expect(isAllowedOrigin(origin, SITE, 'development')).toBe(true);
    expect(isAllowedOrigin(origin, SITE, 'test')).toBe(true);
  });

  it.each(['http://localhost:3000', 'https://abc-def.ngrok-free.dev', 'https://evil.example'])(
    'refuses %s in production',
    (origin) => {
      expect(isAllowedOrigin(origin, SITE, 'production')).toBe(false);
    },
  );

  it('treats a missing environment as production, so a missing setting never widens the check', () => {
    expect(isAllowedOrigin('http://localhost:3000', SITE)).toBe(false);
    expect(isAllowedOrigin('https://abc.ngrok.io', SITE, undefined)).toBe(false);
  });

  it('refuses other sites, look-alike hosts and malformed origins even in development', () => {
    expect(isAllowedOrigin('https://evil.example', SITE, 'development')).toBe(false);
    expect(isAllowedOrigin('https://ngrok.io.evil.example', SITE, 'development')).toBe(false);
    expect(isAllowedOrigin('not a url', SITE, 'development')).toBe(false);
  });
});
