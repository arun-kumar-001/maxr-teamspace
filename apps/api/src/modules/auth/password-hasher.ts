import { randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

export interface PasswordHasher {
  hash(password: string): Promise<string>;
  /** False for a wrong password and for a malformed stored hash; never throws. */
  verify(storedHash: string, password: string): Promise<boolean>;
}

export interface Argon2Params {
  /** KiB. */
  memoryCost: number;
  timeCost: number;
  parallelism: number;
}

/** ADR D-05: 64 MiB, 3 passes, one lane (a single lane keeps a login burst from saturating all cores). */
export const PRODUCTION_ARGON2_PARAMS: Argon2Params = {
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
};

export function createArgon2Hasher(
  params: Argon2Params = PRODUCTION_ARGON2_PARAMS,
): PasswordHasher {
  return {
    // Algorithm 2 is Argon2id (the library's const enum cannot be imported under isolatedModules).
    hash: (password) => hash(password, { algorithm: 2, ...params }),
    verify: async (storedHash, password) => {
      try {
        return await verify(storedHash, password);
      } catch {
        return false;
      }
    },
  };
}

/**
 * A hash of a random password, used to spend the same time when the account does not exist, so
 * response time does not reveal which emails are registered.
 */
export function createDummyHashProvider(hasher: PasswordHasher): () => Promise<string> {
  let pending: Promise<string> | null = null;
  return () => {
    pending ??= hasher.hash(randomBytes(24).toString('base64url'));
    return pending;
  };
}
