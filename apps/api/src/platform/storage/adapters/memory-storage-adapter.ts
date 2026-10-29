import { assertValidKey } from '../keys';
import { StorageAdapter, StoredFile, StoredObjectMeta } from '../types';

/** Keeps files in memory. For tests only: nothing survives a restart. */
export class InMemoryStorageAdapter implements StorageAdapter {
  private readonly files = new Map<string, StoredFile>();

  async put(key: string, body: Buffer, meta: StoredObjectMeta): Promise<void> {
    assertValidKey(key);
    this.files.set(key, { body: Buffer.from(body), meta: { ...meta } });
  }

  async get(key: string): Promise<StoredFile | null> {
    assertValidKey(key);
    const file = this.files.get(key);
    return file ? { body: Buffer.from(file.body), meta: { ...file.meta } } : null;
  }

  async delete(key: string): Promise<boolean> {
    assertValidKey(key);
    return this.files.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    assertValidKey(key);
    return this.files.has(key);
  }

  get size(): number {
    return this.files.size;
  }
}
