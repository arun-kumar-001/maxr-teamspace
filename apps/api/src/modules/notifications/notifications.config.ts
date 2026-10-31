export interface NotificationsConfig {
  /** Base URL of the web app, without a trailing slash. Emails link to it when it is set. */
  appUrl?: string;
  /** Whether this process runs the background jobs (reminders, retention). */
  jobsEnabled: boolean;
  jobsIntervalMs: number;
}

const fail = (message: string): never => {
  throw new Error(`[Config Error] ${message}`);
};

/** Reads APP_URL, JOBS_ENABLED and JOBS_INTERVAL_MS. Fails fast on a value that cannot be used. */
export function loadNotificationsConfig(env: NodeJS.ProcessEnv = process.env): NotificationsConfig {
  let appUrl: string | undefined;
  if (env.APP_URL) {
    let parsed: URL | undefined;
    try {
      parsed = new URL(env.APP_URL);
    } catch {
      parsed = undefined;
    }
    if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
      fail(`APP_URL must be an http or https URL, got '${env.APP_URL}'`);
    }
    if (parsed && env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      fail('APP_URL must use https in production');
    }
    appUrl = (parsed as URL).origin;
  }

  const rawEnabled = env.JOBS_ENABLED;
  if (rawEnabled !== undefined && rawEnabled !== '' && !['true', 'false'].includes(rawEnabled)) {
    fail(`JOBS_ENABLED must be 'true' or 'false', got '${rawEnabled}'`);
  }
  const jobsEnabled = rawEnabled === undefined || rawEnabled === '' ? true : rawEnabled === 'true';

  let jobsIntervalMs = 15 * 60 * 1000;
  if (env.JOBS_INTERVAL_MS) {
    const value = Number(env.JOBS_INTERVAL_MS);
    if (!Number.isInteger(value) || value < 1000 || value > 24 * 60 * 60 * 1000) {
      fail(
        `JOBS_INTERVAL_MS must be an integer between 1000 and 86400000, got '${env.JOBS_INTERVAL_MS}'`,
      );
    }
    jobsIntervalMs = value;
  }
  return { appUrl, jobsEnabled, jobsIntervalMs };
}
