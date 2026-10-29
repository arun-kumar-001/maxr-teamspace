/** Storage keys are lowercase path segments of [a-z0-9_-], e.g. `receipts/2026/10/3f2b...`. */
const KEY_PATTERN = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/;
const MAX_KEY_LENGTH = 200;

export function isValidKey(key: unknown): key is string {
  return (
    typeof key === 'string' &&
    key.length > 0 &&
    key.length <= MAX_KEY_LENGTH &&
    KEY_PATTERN.test(key)
  );
}

export function assertValidKey(key: unknown): asserts key is string {
  if (!isValidKey(key)) {
    // The value is not echoed: it may be attacker-controlled.
    throw new Error('Invalid storage key');
  }
}
