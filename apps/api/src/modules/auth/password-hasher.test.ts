import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_ARGON2_PARAMS,
  createArgon2Hasher,
  createDummyHashProvider,
} from './password-hasher';
import { testHasher } from './auth.testing';

describe('password hasher (Argon2id, ADR D-05)', () => {
  it('produces Argon2id hashes that verify only the right password', async () => {
    const hash = await testHasher.hash('Correct-horse-9-battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await testHasher.verify(hash, 'Correct-horse-9-battery')).toBe(true);
    expect(await testHasher.verify(hash, 'correct-horse-9-battery')).toBe(false);
    expect(await testHasher.verify(hash, '')).toBe(false);
  });

  it('salts every hash differently', async () => {
    const [a, b] = await Promise.all([
      testHasher.hash('same-password-123'),
      testHasher.hash('same-password-123'),
    ]);
    expect(a).not.toBe(b);
  });

  it('never throws on a malformed stored hash, and rejects it', async () => {
    expect(await testHasher.verify('not-a-hash', 'x')).toBe(false);
    expect(await testHasher.verify('', 'x')).toBe(false);
  });

  it('uses the parameters of the ADR in production', async () => {
    expect(PRODUCTION_ARGON2_PARAMS).toEqual({ memoryCost: 65_536, timeCost: 3, parallelism: 1 });
    const hash = await createArgon2Hasher().hash('Correct-horse-9-battery');
    expect(hash).toContain('$m=65536,t=3,p=1$');
  });

  it('hashes the dummy password once and reuses it', async () => {
    let calls = 0;
    const counting = {
      hash: async (p: string) => {
        calls += 1;
        return testHasher.hash(p);
      },
      verify: testHasher.verify,
    };
    const dummy = createDummyHashProvider(counting);
    expect(await dummy()).toBe(await dummy());
    expect(calls).toBe(1);
  });
});
