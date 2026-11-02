export interface AuthConfig {
  cookieName: string;
  /** `Secure` flag. Always true in production (the config refuses anything else there). */
  cookieSecure: boolean;
  /** Longest a session lives, whatever the activity. */
  sessionMaxAgeMs: number;
  /** A session with no request for this long ends. */
  sessionIdleMs: number;
  /** Failed logins for one identifier inside the window before it is locked. */
  maxLoginFailures: number;
  lockoutWindowMs: number;
  /** The only browser origin allowed to send state-changing requests with the session cookie. */
  allowedOrigin: string;
  minPasswordLength: number;
  maxPasswordLength: number;
}

function readInt(name: string, raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined || raw === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`[Config Error] ${name} must be an integer >= ${min}, got '${raw}'`);
  }
  return value;
}

export function loadAuthConfig(
  env: NodeJS.ProcessEnv,
  nodeEnv: string,
  allowedOrigin: string,
): AuthConfig {
  const production = nodeEnv === 'production';
  const secureOverride = env.AUTH_COOKIE_SECURE;
  const cookieSecure = secureOverride === undefined ? production : secureOverride === 'true';
  if (production && !cookieSecure) {
    throw new Error('[Config Error] AUTH_COOKIE_SECURE must be true in production');
  }

  const sessionMaxAgeMs = readInt('SESSION_MAX_AGE_MS', env.SESSION_MAX_AGE_MS, 86_400_000, 60_000);
  const sessionIdleMs = Math.min(
    readInt('SESSION_IDLE_TIMEOUT_MS', env.SESSION_IDLE_TIMEOUT_MS, 7_200_000, 60_000),
    sessionMaxAgeMs,
  );

  return {
    cookieName: 'maxr_session',
    cookieSecure,
    sessionMaxAgeMs,
    sessionIdleMs,
    maxLoginFailures: readInt('LOGIN_MAX_FAILURES', env.LOGIN_MAX_FAILURES, 5, 1),
    lockoutWindowMs: readInt('LOGIN_LOCKOUT_WINDOW_MS', env.LOGIN_LOCKOUT_WINDOW_MS, 900_000, 1000),
    allowedOrigin,
    minPasswordLength: 12,
    maxPasswordLength: 128,
  };
}
