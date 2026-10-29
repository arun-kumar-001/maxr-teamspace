import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  COLOR_TOKENS,
  CHART_TOKENS,
  RADIUS_TOKENS,
  FLUID_TYPOGRAPHY,
  SPACING_TOKENS,
} from '../styles/tokens.js';

const css = readFileSync(resolve(import.meta.dirname, '../styles/tokens.css'), 'utf8');
const cssVar = (name: string): string | undefined =>
  css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toUpperCase();
const kebab = (key: string): string => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

describe('TC-10-01: Design Token Integrity (MaxR Flow palette)', () => {
  it('uses the colours sampled from the MaxR Flow reference', () => {
    expect(COLOR_TOKENS.primary).toBe('#46C7B8');
    expect(COLOR_TOKENS.primarySoft).toBe('#E9F8F6');
    expect(COLOR_TOKENS.bg).toBe('#F8FAFC');
    expect(COLOR_TOKENS.border).toBe('#EEF0F4');
    expect(COLOR_TOKENS.text).toBe('#1A2332');
    expect(CHART_TOKENS.map((c) => c.fill)).toEqual([
      '#3B82F6',
      '#46C7B8',
      '#EC4899',
      '#8B5CF6',
      '#F59E0B',
      '#10B981',
      '#EF4444',
    ]);
  });

  it('keeps tokens.ts and tokens.css in sync (CSS is what the UI uses)', () => {
    for (const [key, value] of Object.entries(COLOR_TOKENS)) {
      expect(cssVar(kebab(key)), `--${kebab(key)}`).toBe(value);
    }
    CHART_TOKENS.forEach((c, i) => {
      expect(cssVar(`chart-${i + 1}`)).toBe(c.fill);
      expect(cssVar(`chart-ink-${i + 1}`)).toBe(c.ink);
    });
  });

  it('uses the MaxR Flow radii (10px inputs, 16px cards, 20px panels)', () => {
    expect(RADIUS_TOKENS.input).toBe('10px');
    expect(RADIUS_TOKENS.card).toBe('16px');
    expect(RADIUS_TOKENS.panel).toBe('20px');
    expect(css).toMatch(/--radius-card:\s*16px/);
  });

  it('should verify 8px base spacing scale', () => {
    expect(SPACING_TOKENS[2]).toBe('0.5rem');
    expect(SPACING_TOKENS[4]).toBe('1rem');
    expect(SPACING_TOKENS[8]).toBe('2rem');
  });

  it('should define valid CSS clamp() functions for fluid typography', () => {
    Object.values(FLUID_TYPOGRAPHY).forEach((value) => {
      expect(value).toMatch(/^clamp\(.+\)$/);
      expect(value.includes('vw')).toBe(true);
    });
  });
});
