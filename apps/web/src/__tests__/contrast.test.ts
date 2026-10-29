import { describe, it, expect } from 'vitest';
import { COLOR_TOKENS as C, CHART_TOKENS } from '../styles/tokens.js';
import { getContrastRatio } from '../styles/contrast.js';

const WHITE = '#FFFFFF';

// Every text/background pairing the components use. Small text needs 4.5:1 (WCAG 2.1 AA).
const TEXT_PAIRS: Array<[string, string, string]> = [
  ['heading text on surface', C.text, C.surface],
  ['body text on surface', C.textMuted, C.surface],
  ['captions on surface', C.textSubtle, C.surface],
  ['captions on page background', C.textSubtle, C.bg],
  ['captions on tiles', C.textSubtle, C.surfaceMuted],
  ['teal text on surface', C.primaryInk, C.surface],
  ['teal text on soft teal (active nav, pills)', C.primaryInk, C.primarySoft],
  ['white on primary button', WHITE, C.primaryDeep],
  ['white on primary button hover', WHITE, C.primaryDeeper],
  ['heading text on hero gradient end', C.text, C.heroTo],
  ['body text on hero gradient end', C.textMuted, C.heroTo],
];

describe('TC-10-03: WCAG 2.1 AA contrast for the MaxR Flow palette', () => {
  it.each(TEXT_PAIRS)('%s reaches 4.5:1', (_name, fg, bg) => {
    expect(getContrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('pipeline numbers (large bold text) reach 3:1 on tiles in every chart colour', () => {
    for (const c of CHART_TOKENS) {
      expect(getContrastRatio(c.ink, C.surfaceMuted), c.name).toBeGreaterThanOrEqual(3);
    }
  });

  it('focus ring and icon colour reach 3:1 against white (non-text contrast)', () => {
    expect(getContrastRatio(C.primaryStrong, C.surface)).toBeGreaterThanOrEqual(3);
    expect(getContrastRatio(C.primaryStrong, C.primarySoft)).toBeGreaterThanOrEqual(3);
  });

  it('documents why the brand teal is never used for text', () => {
    expect(getContrastRatio(C.primary, C.surface)).toBeLessThan(3);
  });
});
