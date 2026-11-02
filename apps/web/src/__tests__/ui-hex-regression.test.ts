import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('TC-11-02: Zero Hardcoded Hex Regression Test', () => {
  it('should guarantee no raw hex codes (#...) are hardcoded in components/ui, shell, dashboards, or auth *.tsx', () => {
    const directories = [
      path.resolve(__dirname, '../components/ui'),
      path.resolve(__dirname, '../shell'),
      path.resolve(__dirname, '../dashboards'),
      path.resolve(__dirname, '../auth'),
    ];

    const hexPattern = /#[0-9a-fA-F]{3,8}\b/g;
    const violations: { file: string; line: number; match: string }[] = [];

    directories.forEach((dir) => {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir).filter((f) => f.endsWith('.tsx') && !f.includes('test'));
      files.forEach((file) => {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const matches = line.match(hexPattern);
          if (matches) {
            matches.forEach((m) => {
              violations.push({ file: `${path.basename(dir)}/${file}`, line: idx + 1, match: m });
            });
          }
        });
      });
    });

    expect(violations).toEqual([]);
  });
});
