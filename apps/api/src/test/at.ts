/**
 * Reads a nested value from parsed JSON without using `any`.
 * `at(doc, 'paths', '/templates', 'get')` ≈ `doc.paths['/templates'].get`
 */
export function at(value: unknown, ...path: string[]): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      current !== null && typeof current === 'object'
        ? (current as Record<string, unknown>)[key]
        : undefined,
    value,
  );
}

/** Like `at`, but for values that must be an object (fails the test clearly if not). */
export function objectAt(value: unknown, ...path: string[]): Record<string, unknown> {
  const found = at(value, ...path);
  if (found === null || typeof found !== 'object') {
    throw new Error(`Expected an object at ${path.join('.')}`);
  }
  return found as Record<string, unknown>;
}
