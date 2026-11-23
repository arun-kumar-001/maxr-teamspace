/**
 * PII / secret redaction for log output (AGENTS.md §7: never log passwords, tokens or PII).
 * Keys are compared after lower-casing and removing non-alphanumerics, so
 * `Password`, `password_hash` and `set-cookie` are all matched.
 */

export const REDACTED = '[REDACTED]';

// Matched as a substring of the normalised key (long, unambiguous words).
const SENSITIVE_SUBSTRINGS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'bankaccount',
  'nationalid',
  'creditcard',
  'cardnumber',
  'compensation',
  'salary',
  'sessionid',
];

// Matched only as the whole key (short words that would cause false positives as substrings).
const SENSITIVE_EXACT = new Set(['ssn', 'iban', 'cvv', 'otp', 'pin', 'pan']);

// Secrets that appear *inside* text (error messages, stack traces, URLs), where the key-based
// check above cannot see them. Each rule keeps the label and replaces only the secret.
const TEXT_RULES: Array<[RegExp, string]> = [
  // Authorization: Bearer abc.def
  [/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/g, `$1 ${'[REDACTED]'}`],
  // password=abc, token: abc, "apiKey":"abc", secret = abc
  [
    /\b(pass(?:word|wd)?|pwd|secret|token|api[_-]?key|authorization)(["']?\s*[=:]\s*["']?)(?!\[REDACTED\])[^\s,;&"'}\]]+/gi,
    `$1$2${'[REDACTED]'}`,
  ],
  // postgres://user:pass@host -> postgres://[REDACTED]@host
  [/(\b[a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${'[REDACTED]'}@`],
];

export function scrubText(text: string): string {
  return TEXT_RULES.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );
}

const MAX_DEPTH = 6;
const MAX_STRING_LENGTH = 2000;

function normalise(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isSensitiveKey(key: string): boolean {
  const k = normalise(key);
  return SENSITIVE_EXACT.has(k) || SENSITIVE_SUBSTRINGS.some((word) => k.includes(word));
}

/** Returns a redacted deep copy that is safe to serialise (handles cycles, errors, dates). */
export function redact(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    const scrubbed = scrubText(value);
    return scrubbed.length > MAX_STRING_LENGTH
      ? `${scrubbed.slice(0, MAX_STRING_LENGTH)}…`
      : scrubbed;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redact(value.message, depth + 1, seen),
      stack: value.stack === undefined ? undefined : scrubText(value.stack),
    };
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  if (depth >= MAX_DEPTH) {
    return '[MaxDepth]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redact(val, depth + 1, seen);
  }
  return out;
}
