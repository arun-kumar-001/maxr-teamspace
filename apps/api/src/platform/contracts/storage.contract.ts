import { describe, expect, it } from 'vitest';
import { StorageAdapter, StoredObjectMeta } from '../storage/types';

const meta = (over: Partial<StoredObjectMeta> = {}): StoredObjectMeta => ({
  contentType: 'application/pdf',
  size: 3,
  sha256: 'a'.repeat(64),
  originalName: 'a.pdf',
  uploadedBy: 'user-1',
  createdAt: '2026-10-29T00:00:00.000Z',
  ...over,
});

export interface StorageContractTarget {
  adapter: StorageAdapter;
  cleanup?: () => Promise<void>;
}

/**
 * Behaviour every storage backend must have: the in-memory and local-disk adapters today, the
 * Cantobo/S3 adapter later (decision D-10). Call it from a test file.
 */
export function describeStorageContract(
  name: string,
  create: () => Promise<StorageContractTarget>,
): void {
  describe(`storage adapter contract: ${name}`, () => {
    const withAdapter = async (run: (adapter: StorageAdapter) => Promise<void>) => {
      const target = await create();
      try {
        await run(target.adapter);
      } finally {
        await target.cleanup?.();
      }
    };

    it('stores bytes and returns exactly the same bytes and metadata', () =>
      withAdapter(async (adapter) => {
        const body = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255]);
        await adapter.put('receipts/2026/10/a-1', body, meta({ size: body.length }));
        const file = await adapter.get('receipts/2026/10/a-1');
        expect(file?.body.equals(body)).toBe(true);
        expect(file?.meta).toEqual(meta({ size: body.length }));
      }));

    it('is binary safe for all 256 byte values', () =>
      withAdapter(async (adapter) => {
        const body = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
        await adapter.put('x/all-bytes', body, meta());
        expect((await adapter.get('x/all-bytes'))?.body.equals(body)).toBe(true);
      }));

    it('returns null / false for a key that does not exist', () =>
      withAdapter(async (adapter) => {
        expect(await adapter.get('nothing/here')).toBeNull();
        expect(await adapter.exists('nothing/here')).toBe(false);
        expect(await adapter.delete('nothing/here')).toBe(false);
      }));

    it('exists and delete agree, and a deleted file is gone', () =>
      withAdapter(async (adapter) => {
        await adapter.put('docs/d-1', Buffer.from('abc'), meta());
        expect(await adapter.exists('docs/d-1')).toBe(true);
        expect(await adapter.delete('docs/d-1')).toBe(true);
        expect(await adapter.exists('docs/d-1')).toBe(false);
        expect(await adapter.get('docs/d-1')).toBeNull();
        expect(await adapter.delete('docs/d-1')).toBe(false);
      }));

    it('putting the same key again replaces the file', () =>
      withAdapter(async (adapter) => {
        await adapter.put('docs/same', Buffer.from('one'), meta());
        await adapter.put('docs/same', Buffer.from('two'), meta());
        expect((await adapter.get('docs/same'))?.body.toString()).toBe('two');
      }));

    it('hands out copies: changing a returned buffer does not change the stored file', () =>
      withAdapter(async (adapter) => {
        await adapter.put('docs/copy', Buffer.from('abc'), meta());
        const first = await adapter.get('docs/copy');
        first?.body.fill(0);
        expect((await adapter.get('docs/copy'))?.body.toString()).toBe('abc');
      }));

    it.each([
      '',
      '../outside',
      'a/../../outside',
      '/absolute/path',
      'a//b',
      'a/./b',
      'UPPER/case',
      'with space/x',
      'semi;colon',
      'back\\slash',
      'nul\u0000byte',
      'a/b/',
      'x'.repeat(201),
    ])('refuses the unsafe key %j on every operation', (key) =>
      withAdapter(async (adapter) => {
        await expect(adapter.put(key, Buffer.from('x'), meta())).rejects.toThrow();
        await expect(adapter.get(key)).rejects.toThrow();
        await expect(adapter.delete(key)).rejects.toThrow();
        await expect(adapter.exists(key)).rejects.toThrow();
      }),
    );
  });
}
