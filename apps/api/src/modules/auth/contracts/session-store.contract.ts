import { describe, expect, it } from 'vitest';
import { SessionStore } from '../session-store';

/** Behaviour every SessionStore must have; the Redis store runs the same suite in session-store.db.test.ts. */
export function describeSessionStoreContract(name: string, make: () => Promise<SessionStore>) {
  describe(`session store contract: ${name}`, () => {
    const record = { userId: 'user-1', csrfToken: 'csrf', createdAt: 1 };

    it('returns what was stored, and null for unknown tokens', async () => {
      const store = await make();
      await store.create('hash-a', record, 60_000);
      expect(await store.get('hash-a')).toEqual(record);
      expect(await store.get('hash-unknown')).toBeNull();
    });

    it('revoke removes only that session', async () => {
      const store = await make();
      await store.create('hash-a', record, 60_000);
      await store.create('hash-b', record, 60_000);
      await store.revoke('hash-a');
      expect(await store.get('hash-a')).toBeNull();
      expect(await store.get('hash-b')).toEqual(record);
    });

    it('revokeAllForUser ends every session of that user, keeps others and the excepted one', async () => {
      const store = await make();
      await store.create('mine-1', record, 60_000);
      await store.create('mine-2', record, 60_000);
      await store.create('mine-3', record, 60_000);
      await store.create('theirs', { ...record, userId: 'user-2' }, 60_000);

      expect(await store.revokeAllForUser('user-1', 'mine-3')).toBe(2);
      expect(await store.get('mine-1')).toBeNull();
      expect(await store.get('mine-2')).toBeNull();
      expect(await store.get('mine-3')).toEqual(record);
      expect(await store.get('theirs')).not.toBeNull();

      expect(await store.revokeAllForUser('user-1')).toBe(1);
      expect(await store.get('mine-3')).toBeNull();
      expect(await store.revokeAllForUser('user-1')).toBe(0);
    });
  });
}
