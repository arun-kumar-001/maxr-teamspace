import { describe, it, expect } from 'vitest';
import { COLOR_TOKENS as C, CHART_TOKENS } from '../styles/tokens.js';
import { getContrastRatio } from '../styles/contrast.js';

const WHITE = '#FFFFFF';

// Every text/background pairing the components use. Small text needs 4.5:1 (WCAG 2.1 AA).
const TEXT_PAIRS: Array<[string, string, string]> = [
  ['text on cards', C.text, C.surface],
  ['muted text on cards', C.textMuted, C.surface],
  ['captions on cards', C.textSubtle, C.surface],
  ['captions on the page', C.textSubtle, C.bg],
  ['captions on tiles and the metric strip', C.textSubtle, C.surfaceMuted],
  ['muted text on the segmented track', C.textMuted, C.track],
  ['teal text on cards', C.primaryInk, C.surface],
  ['teal text on soft teal', C.primaryInk, C.primarySoft],
  ['white on primary button', WHITE, C.primaryDeep],
  ['white on primary button hover', WHITE, C.primaryDeeper],
  ['sidebar text', C.sidebarText, C.sidebarBg],
  ['sidebar group labels', C.sidebarMuted, C.sidebarBg],
  ['sidebar labels on sidebar cards', C.sidebarMuted, C.sidebarRaised],
  ['sidebar text on open group / hover', C.sidebarText, C.sidebarRaised],
  ['active sidebar item (solid teal pill)', C.sidebarBg, C.primary],
  ['attention count on amber', C.sidebarBg, C.sidebarAttention],
  ['user initials on peach avatar', C.sidebarBg, C.tilePeach],
  ['positive delta', C.positiveInk, C.positiveSoft],
  ['negative delta', C.negativeInk, C.negativeSoft],
  ['text on peach tile', C.text, C.tilePeach],
  ['text on yellow tile', C.text, C.tileYellow],
  ['text on blue tile', C.text, C.tileBlue],
  ['text on green tile', C.text, C.tileGreen],
  ['muted text on peach tile', C.textMuted, C.tilePeach],
  ['muted text on yellow tile', C.textMuted, C.tileYellow],
  ['muted text on blue tile', C.textMuted, C.tileBlue],
  ['muted text on green tile', C.textMuted, C.tileGreen],
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

  it('focus ring, icons and the sidebar indicator reach 3:1 (non-text contrast)', () => {
    expect(getContrastRatio(C.primaryStrong, C.surface)).toBeGreaterThanOrEqual(3);
    expect(getContrastRatio(C.primaryStrong, C.bg)).toBeGreaterThanOrEqual(3);
    expect(getContrastRatio(C.primaryStrong, C.primarySoft)).toBeGreaterThanOrEqual(3);
    // Active-item indicator and logo tile on the dark sidebar.
    expect(getContrastRatio(C.primary, C.sidebarBg)).toBeGreaterThanOrEqual(3);
  });

  it('documents why the brand teal is never used for text', () => {
    expect(getContrastRatio(C.primary, C.surface)).toBeLessThan(3);
  });
});
