export interface BackoffOptions {
  baseMs?: number;
  factor?: number;
  maxMs?: number;
}

/**
 * Delay before the next try after `attempt` failed attempts (1-based):
 * 30 s, 60 s, 120 s, 240 s, ... capped at one hour.
 */
export function retryDelayMs(
  attempt: number,
  { baseMs = 30_000, factor = 2, maxMs = 3_600_000 }: BackoffOptions = {},
): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(baseMs * Math.pow(factor, exponent), maxMs);
}
