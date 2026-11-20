import { describe, expect, it } from 'vitest';
import config from '../vite.config';

describe('production build', () => {
  it('does not publish source maps, which would serve the full front-end source', () => {
    expect(config.build?.sourcemap).toBe(false);
  });
});
