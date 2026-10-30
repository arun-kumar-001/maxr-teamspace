import { describe, expect, it } from 'vitest';
import { toCsv } from './csv';

const cols = [
  { key: 'name', label: 'Name' },
  { key: 'note', label: 'Note' },
];

describe('toCsv', () => {
  it('writes a BOM, CRLF lines and only the declared columns in order', () => {
    const csv = toCsv(cols, [{ name: 'Asha', note: 'ok', secret: 'bank-123' }]);
    expect(csv).toBe('﻿Name,Note\r\nAsha,ok\r\n');
    expect(csv).not.toContain('bank-123');
  });

  it('quotes commas, quotes and line breaks (RFC 4180)', () => {
    const csv = toCsv(cols, [{ name: 'A, B', note: 'say "hi"\nbye' }]);
    expect(csv).toContain('"A, B","say ""hi""\nbye"');
  });

  it.each(['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx'])(
    'neutralises the formula start %j in text',
    (value) => {
      const line = toCsv(cols, [{ name: value, note: '' }]).split('\r\n')[1] ?? '';
      expect(line.replace(/^"/, '')).toMatch(/^'/);
    },
  );

  it('leaves numbers (including negatives), booleans, dates and empties alone', () => {
    const csv = toCsv(
      [
        { key: 'a', label: 'a' },
        { key: 'b', label: 'b' },
        { key: 'c', label: 'c' },
        { key: 'd', label: 'd' },
        { key: 'e', label: 'e' },
      ],
      [{ a: -5, b: true, c: new Date('2026-10-30T00:00:00Z'), d: null }],
    );
    expect(csv.split('\r\n')[1]).toBe('-5,true,2026-10-30T00:00:00.000Z,,');
  });
});
