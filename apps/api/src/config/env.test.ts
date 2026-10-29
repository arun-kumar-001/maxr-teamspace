import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadAndValidateConfig } from './env';

const KEYS = ['NODE_ENV', 'DATABASE_URL', 'SESSION_SECRET'] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of KEYS) saved[k] = process.env[k];
  process.env.NODE_ENV = 'production';
  process.env.DATABASE_URL = 'postgresql://u:p@db:5432/app';
});

afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('SESSION_SECRET production guard (#52 F6)', () => {
  it.each([
    ['change-this-to-a-secure-random-secret-in-production-min-32-chars'],
    ['development-fallback-session-secret-min-32-chars-long'],
    ['please-set-a-real-placeholder-value-here-1234567890'],
  ])('rejects the placeholder %j', (secret) => {
    process.env.SESSION_SECRET = secret;
    expect(() => loadAndValidateConfig()).toThrow(/placeholder/);
  });

  it('rejects a short secret', () => {
    process.env.SESSION_SECRET = 'short';
    expect(() => loadAndValidateConfig()).toThrow(/at least 32/);
  });

  it('accepts a random 48 character secret', () => {
    process.env.SESSION_SECRET = 'q8Zr2LkV9xT4mWb7NcYd1HsJf6GaP3eUo5RiXt0KvBnMzC2w';
    expect(loadAndValidateConfig().SESSION_SECRET).toHaveLength(48);
  });

  it('still allows the fallback outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SESSION_SECRET;
    expect(loadAndValidateConfig().SESSION_SECRET.length).toBeGreaterThanOrEqual(32);
  });
});
