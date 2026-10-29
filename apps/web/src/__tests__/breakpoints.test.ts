import { describe, it, expect } from 'vitest';
import {
  BREAKPOINTS,
  REFERENCE_VIEWPORTS,
  getBreakpointForWidth,
} from '../styles/breakpoints.js';

describe('TC-10-02: Responsive Breakpoint Verification', () => {
  it('should define the 8 mandatory breakpoints from AGENTS.md §8', () => {
    expect(BREAKPOINTS.xs).toBe(360);
    expect(BREAKPOINTS.sm).toBe(640);
    expect(BREAKPOINTS.md).toBe(768);
    expect(BREAKPOINTS.lg).toBe(1024);
    expect(BREAKPOINTS.xl).toBe(1280);
    expect(BREAKPOINTS['2xl']).toBe(1536);
    expect(BREAKPOINTS['3xl']).toBe(1920);
    expect(BREAKPOINTS['4xl']).toBe(2560);
  });

  it('should be strictly monotonic (xs < sm < md < lg < xl < 2xl < 3xl < 4xl)', () => {
    const values = [
      BREAKPOINTS.xs,
      BREAKPOINTS.sm,
      BREAKPOINTS.md,
      BREAKPOINTS.lg,
      BREAKPOINTS.xl,
      BREAKPOINTS['2xl'],
      BREAKPOINTS['3xl'],
      BREAKPOINTS['4xl'],
    ];

    for (let i = 0; i < values.length - 1; i++) {
      const current = values[i];
      const next = values[i + 1];
      if (current !== undefined && next !== undefined) {
        expect(current).toBeLessThan(next);
      }
    }
  });

  it('should correctly classify all 9 mandatory reference viewports from AGENTS.md §8', () => {
    expect(REFERENCE_VIEWPORTS.length).toBe(9);

    // 360x640 (Phone) -> xs
    expect(getBreakpointForWidth(360)).toBe('xs');
    // 390x844 (Modern Phone) -> xs
    expect(getBreakpointForWidth(390)).toBe('xs');
    // 768x1024 (Tablet) -> md
    expect(getBreakpointForWidth(768)).toBe('md');
    // 1024x768 (Laptop) -> lg
    expect(getBreakpointForWidth(1024)).toBe('lg');
    // 1366x768 (Desktop) -> xl
    expect(getBreakpointForWidth(1366)).toBe('xl');
    // 1440x900 (Desktop) -> xl
    expect(getBreakpointForWidth(1440)).toBe('xl');
    // 1920x1080 (FHD) -> 3xl
    expect(getBreakpointForWidth(1920)).toBe('3xl');
    // 2560x1440 (QHD) -> 4xl
    expect(getBreakpointForWidth(2560)).toBe('4xl');
    // 3440x1440 (Ultrawide) -> 4xl
    expect(getBreakpointForWidth(3440)).toBe('4xl');
  });
});
