import { describe, it, expect } from 'vitest';
import { COLOR_TOKENS, RADIUS_TOKENS, FLUID_TYPOGRAPHY, SPACING_TOKENS } from '../styles/tokens.js';

describe('TC-10-01: Design Token Integrity', () => {
  it('should match authoritative hex colors from AGENTS.md §8', () => {
    expect(COLOR_TOKENS.navy950).toBe('#0A1429');
    expect(COLOR_TOKENS.navy900).toBe('#0E2042');
    expect(COLOR_TOKENS.navy800).toBe('#1E2F50');
    expect(COLOR_TOKENS.teal500).toBe('#14B8A6');
    expect(COLOR_TOKENS.teal600).toBe('#0D9488');
    expect(COLOR_TOKENS.brandRed).toBe('#E5322D');
    expect(COLOR_TOKENS.bg).toBe('#F6F8FB');
    expect(COLOR_TOKENS.surface).toBe('#FFFFFF');
    expect(COLOR_TOKENS.text).toBe('#0F172A');
    expect(COLOR_TOKENS.textMuted).toBe('#475569');
    expect(COLOR_TOKENS.border).toBe('#E2E8F0');
    expect(COLOR_TOKENS.success).toBe('#16A34A');
    expect(COLOR_TOKENS.warning).toBe('#D97706');
    expect(COLOR_TOKENS.danger).toBe('#DC2626');
    expect(COLOR_TOKENS.info).toBe('#2563EB');
  });

  it('should enforce 6px input and 8px card radius rules from AGENTS.md §8', () => {
    expect(RADIUS_TOKENS.input).toBe('6px');
    expect(RADIUS_TOKENS.card).toBe('8px');
  });

  it('should verify 8px base spacing scale', () => {
    expect(SPACING_TOKENS[2]).toBe('0.5rem'); // 8px
    expect(SPACING_TOKENS[4]).toBe('1rem'); // 16px
    expect(SPACING_TOKENS[8]).toBe('2rem'); // 32px
  });

  it('should define valid CSS clamp() functions for fluid typography', () => {
    Object.values(FLUID_TYPOGRAPHY).forEach((value) => {
      expect(value).toMatch(/^clamp\(.+\)$/);
      expect(value.includes('vw')).toBe(true);
    });
  });
});
