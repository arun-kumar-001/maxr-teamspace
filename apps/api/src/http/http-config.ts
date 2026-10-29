export interface HttpConfig {
  /** Number of reverse-proxy hops to trust for `req.ip` (0 locally, 1 behind Nginx). */
  trustProxy: number;
  rateLimit: { windowMs: number; max: number };
}

function readInt(name: string, raw: string | undefined, fallback: number, min: number): number {
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min) {
    throw new Error(`[Config Error] ${name} must be an integer >= ${min}, got '${raw}'`);
  }
  return value;
}

export function loadHttpConfig(env: NodeJS.ProcessEnv = process.env): HttpConfig {
  return {
    trustProxy: readInt('TRUST_PROXY', env.TRUST_PROXY, 0, 0),
    rateLimit: {
      windowMs: readInt('RATE_LIMIT_WINDOW_MS', env.RATE_LIMIT_WINDOW_MS, 60_000, 1000),
      max: readInt('RATE_LIMIT_MAX', env.RATE_LIMIT_MAX, 300, 1),
    },
  };
}
