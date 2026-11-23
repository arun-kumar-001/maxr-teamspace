// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { LogoError, prepareLogo } from '../components/prepare-logo';

const file = (type: string, content = 'x') => new File([content], 'logo', { type });

describe('prepareLogo', () => {
  it.each(['image/svg+xml', 'text/html', 'application/pdf', 'image/gif'])(
    'refuses %s, which the server does not accept',
    async (type) => {
      await expect(prepareLogo(file(type))).rejects.toBeInstanceOf(LogoError);
    },
  );

  it.each(['image/png', 'image/jpeg', 'image/webp'])('uses a small %s as it is', async (type) => {
    const url = await prepareLogo(file(type, 'tiny'));
    expect(url.startsWith(`data:${type};base64,`)).toBe(true);
  });
});
