import { describe, expect, it } from 'vitest';
import { loadNotificationsConfig } from './notifications.config';

describe('loadNotificationsConfig', () => {
  it('defaults to jobs on, every 15 minutes, and no app URL', () => {
    expect(loadNotificationsConfig({})).toEqual({
      appUrl: undefined,
      jobsEnabled: true,
      jobsIntervalMs: 900_000,
    });
  });

  it('reads the settings and reduces the URL to its origin', () => {
    expect(
      loadNotificationsConfig({
        APP_URL: 'https://teamspace.example.com/some/path/',
        JOBS_ENABLED: 'false',
        JOBS_INTERVAL_MS: '60000',
      }),
    ).toEqual({
      appUrl: 'https://teamspace.example.com',
      jobsEnabled: false,
      jobsIntervalMs: 60_000,
    });
  });

  it.each([
    ['a URL that is not one', { APP_URL: 'teamspace' }],
    ['a URL with another scheme', { APP_URL: 'javascript:alert(1)' }],
    ['http in production', { APP_URL: 'http://teamspace.example.com', NODE_ENV: 'production' }],
    ['JOBS_ENABLED that is not true or false', { JOBS_ENABLED: 'yes' }],
    ['an interval that is not a number', { JOBS_INTERVAL_MS: 'soon' }],
    ['an interval under a second', { JOBS_INTERVAL_MS: '999' }],
    ['an interval over a day', { JOBS_INTERVAL_MS: '86400001' }],
  ])('rejects %s', (_name, env) => {
    expect(() => loadNotificationsConfig(env as NodeJS.ProcessEnv)).toThrow('[Config Error]');
  });

  it('allows http outside production', () => {
    expect(loadNotificationsConfig({ APP_URL: 'http://localhost:3000' }).appUrl).toBe(
      'http://localhost:3000',
    );
  });
});
