import { describe, expect, it } from 'vitest';
import {
  assertClaimDate,
  assertReceiptRule,
  assertTransition,
  EXPENSE_TRANSITIONS,
} from './expenses.rules';
import { EXPENSE_STATUSES } from './expenses.types';

describe('expense claim states (D-17)', () => {
  it.each([
    ['draft', 'submitted'],
    ['draft', 'cancelled'],
    ['submitted', 'approved'],
    ['submitted', 'rejected'],
    ['submitted', 'cancelled'],
    ['approved', 'reimbursed'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each([
    ['draft', 'approved'],
    ['draft', 'reimbursed'],
    ['submitted', 'reimbursed'],
    ['approved', 'cancelled'],
    ['approved', 'rejected'],
    ['rejected', 'submitted'],
    ['cancelled', 'draft'],
    ['reimbursed', 'approved'],
  ] as const)('refuses %s -> %s with a 409', (from, to) => {
    expect(() => assertTransition(from, to)).toThrow(expect.objectContaining({ statusCode: 409 }));
  });

  it('gives every status a transition entry, and the final ones none', () => {
    expect(Object.keys(EXPENSE_TRANSITIONS).sort()).toEqual([...EXPENSE_STATUSES].sort());
    for (const final of ['rejected', 'cancelled', 'reimbursed'] as const) {
      expect(EXPENSE_TRANSITIONS[final]).toEqual([]);
    }
  });
});

describe('the claim window: not in the future, at most 60 days back', () => {
  const today = '2026-10-31';

  it('accepts today and exactly 60 days back', () => {
    expect(() => assertClaimDate(today, today)).not.toThrow();
    expect(() => assertClaimDate('2026-09-01', today)).not.toThrow();
  });

  it('refuses tomorrow and 61 days back', () => {
    expect(() => assertClaimDate('2026-11-01', today)).toThrow(
      expect.objectContaining({ statusCode: 422 }),
    );
    expect(() => assertClaimDate('2026-08-31', today)).toThrow(
      expect.objectContaining({ statusCode: 422 }),
    );
  });

  it('counts across a leap day', () => {
    expect(() => assertClaimDate('2028-02-28', '2028-04-28')).not.toThrow(); // 60 days
    expect(() => assertClaimDate('2028-02-27', '2028-04-28')).toThrow(); // 61 days
  });
});

describe('the receipt rule: needed above 200.00 INR', () => {
  it('needs a receipt above 20,000 paise and not at the limit', () => {
    expect(() => assertReceiptRule(20_000, false)).not.toThrow();
    expect(() => assertReceiptRule(20_001, false)).toThrow(
      expect.objectContaining({ statusCode: 422 }),
    );
    expect(() => assertReceiptRule(20_001, true)).not.toThrow();
  });
});
