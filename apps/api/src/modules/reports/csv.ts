export type CellValue = string | number | boolean | Date | null | undefined;

export interface CsvColumn {
  key: string;
  label: string;
}

/** Excel opens UTF-8 CSV correctly only with a byte order mark. */
const BOM = '﻿';

/**
 * A text cell starting with one of these is read as a formula by spreadsheet programs
 * (CSV injection). A leading apostrophe makes it plain text. Numbers are never touched.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value: CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text: string;
  if (value instanceof Date) {
    text = value.toISOString();
  } else if (typeof value === 'string') {
    text = FORMULA_START.test(value) ? `'${value}` : value;
  } else {
    text = String(value);
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 CSV. Only the declared columns are written, in the declared order, so a row object
 * carrying extra fields can never leak them into an export.
 */
export function toCsv(columns: CsvColumn[], rows: Array<Record<string, CellValue>>): string {
  const lines = [columns.map((c) => cell(c.label)).join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => cell(row[c.key])).join(','));
  }
  return `${BOM}${lines.join('\r\n')}\r\n`;
}
