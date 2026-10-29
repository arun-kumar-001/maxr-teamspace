import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TC-11-02: Zero Hardcoded Hex Regression Test', () => {
  it('should guarantee no raw hex codes (#...) are hardcoded in components/ui/*.tsx', () => {
    const uiDir = path.resolve(__dirname, '../components/ui');
    const files = fs.readdirSync(uiDir).filter((f) => f.endsWith('.tsx') && !f.includes('test'));

    expect(files.length).toBeGreaterThan(0);

    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const violations: { file: string; line: number; match: string }[] = [];

    files.forEach((file) => {
      const content = fs.readFileSync(path.join(uiDir, file), 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const matches = line.match(hexPattern);
        if (matches) {
          matches.forEach((m) => {
            violations.push({ file, line: idx + 1, match: m });
          });
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
