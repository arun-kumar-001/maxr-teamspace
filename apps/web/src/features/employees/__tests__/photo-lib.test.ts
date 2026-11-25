import { describe, expect, it } from 'vitest';
import { dataUrlToFile, photoProblem } from '../lib/photo';

describe('employee photo helpers', () => {
  it('accepts PNG and JPEG up to 2 MB and says what is wrong otherwise', () => {
    expect(photoProblem({ type: 'image/png', size: 1000 })).toBeNull();
    expect(photoProblem({ type: 'image/jpeg', size: 2 * 1024 * 1024 })).toBeNull();
    expect(photoProblem({ type: 'image/webp', size: 1000 })).toMatch(/PNG or JPEG/);
    expect(photoProblem({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toMatch(/2 MB/);
  });

  it('turns the preview data URL into a file with the same bytes and type', async () => {
    const file = dataUrlToFile('data:image/png;base64,iVBORw0KGgo=', 'employee');
    expect(file?.name).toBe('employee.png');
    expect(file?.type).toBe('image/png');
    expect(Array.from(new Uint8Array(await file!.arrayBuffer()))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  it('refuses anything that is not a PNG or JPEG data URL', () => {
    expect(dataUrlToFile('data:image/webp;base64,AAAA', 'x')).toBeNull();
    expect(dataUrlToFile('not a data url', 'x')).toBeNull();
  });
});
