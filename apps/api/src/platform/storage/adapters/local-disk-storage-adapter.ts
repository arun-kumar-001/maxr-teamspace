import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { assertValidKey } from '../keys';
import { StorageAdapter, StoredFile, StoredObjectMeta } from '../types';

/**
 * Stores files under one root folder (development and CI). A key can never leave the root:
 * it must be [a-z0-9_-] path segments, and the resolved path is checked again.
 */
export class LocalDiskStorageAdapter implements StorageAdapter {
  private readonly root: string;

  constructor(rootDir: string) {
    this.root = path.resolve(rootDir);
  }

  private pathsFor(key: string): { data: string; meta: string } {
    assertValidKey(key);
    const base = path.resolve(this.root, key);
    if (!base.startsWith(this.root + path.sep)) {
      throw new Error('Invalid storage key');
    }
    return { data: `${base}.bin`, meta: `${base}.meta.json` };
  }

  async put(key: string, body: Buffer, meta: StoredObjectMeta): Promise<void> {
    const target = this.pathsFor(key);
    await fs.mkdir(path.dirname(target.data), { recursive: true, mode: 0o700 });
    // Write to a temporary name and rename, so readers never see half a file.
    const tmp = `${target.data}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, body, { mode: 0o600 });
    await fs.writeFile(target.meta, JSON.stringify(meta), { mode: 0o600 });
    await fs.rename(tmp, target.data);
  }

  async get(key: string): Promise<StoredFile | null> {
    const target = this.pathsFor(key);
    try {
      const [body, rawMeta] = await Promise.all([
        fs.readFile(target.data),
        fs.readFile(target.meta, 'utf8'),
      ]);
      return { body, meta: JSON.parse(rawMeta) as StoredObjectMeta };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  async delete(key: string): Promise<boolean> {
    const target = this.pathsFor(key);
    const existed = await this.exists(key);
    await Promise.all([fs.rm(target.data, { force: true }), fs.rm(target.meta, { force: true })]);
    return existed;
  }

  async exists(key: string): Promise<boolean> {
    const target = this.pathsFor(key);
    try {
      await fs.access(target.data);
      return true;
    } catch {
      return false;
    }
  }
}
