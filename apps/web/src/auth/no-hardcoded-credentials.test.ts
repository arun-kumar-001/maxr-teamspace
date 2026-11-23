import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('the web app carries no login credentials in its source', () => {
  it('AuthContext reads any development login from the environment, not from code', () => {
    const source = readFileSync(new URL('./AuthContext.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/Password123!/);
    expect(source).not.toMatch(/admin@maxr\.internal/);
    expect(source).toMatch(/VITE_DEV_MOCK_PASSWORD/);
  });
});
