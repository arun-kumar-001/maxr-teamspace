import { describe, expect, it } from 'vitest';
import { formatTenure } from '../lib/tenure';

const NOW = new Date(2026, 10, 24, 15, 30); // 24 Nov 2026, local time

describe('formatTenure', () => {
  it.each([
    ['2026-11-24', 'Joined today'],
    ['2026-11-23', '1 day'],
    ['2026-11-15', '9 days'],
    ['2026-06-24', '5 mo'],
    ['2026-06-25', '4 mo'],
    ['2025-11-24', '1 yr'],
    ['2024-02-29', '2 yr 8 mo'],
    ['2023-12-31', '2 yr 10 mo'],
    ['2026-11-25', 'Starts in 1 day'],
    ['2026-12-10', 'Starts in 16 days'],
  ])('reads %s as "%s"', (joined, expected) => {
    expect(formatTenure(joined, NOW)).toBe(expected);
  });

  it('shows a dash when there is no usable date', () => {
    expect(formatTenure(null, NOW)).toBe('—');
    expect(formatTenure(undefined, NOW)).toBe('—');
    expect(formatTenure('not-a-date', NOW)).toBe('—');
  });
});
