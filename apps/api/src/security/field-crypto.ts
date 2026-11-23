import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Field-level encryption for the few values that must not sit in the database as plain text:
 * Aadhaar and PAN numbers and bank account numbers. A stolen database dump or backup then reveals
 * nothing without the separate FIELD_ENCRYPTION_KEY.
 *
 * AES-256-GCM, a fresh random IV per value, and the column name as additional authenticated data,
 * so a value copied into another column fails to decrypt. Stored form: `enc:v1:<iv>.<tag>.<data>`
 * (base64url). The version prefix leaves room for key rotation.
 */
const PREFIX = 'enc:v1:';
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** Development and test only. Production refuses to start without its own key. */
export const DEV_FIELD_ENCRYPTION_KEY = Buffer.alloc(KEY_BYTES, 'maxr-dev-field-key').toString(
  'base64',
);

export class FieldCryptoError extends Error {}

export function parseFieldEncryptionKey(raw: string): Buffer {
  const key = Buffer.from(raw.trim(), 'base64');
  if (key.length !== KEY_BYTES) {
    throw new FieldCryptoError(
      `FIELD_ENCRYPTION_KEY must be ${KEY_BYTES} random bytes encoded as base64 (openssl rand -base64 32).`,
    );
  }
  return key;
}

export interface FieldCipher {
  /** Encrypts for storage. null and the empty string are stored as they are. */
  encrypt(plain: string | null, column: string): string | null;
  /** Reads a stored value. A value that was never encrypted (before the backfill) is returned as is. */
  decrypt(stored: string | null, column: string): string | null;
  isEncrypted(stored: string | null): boolean;
}

export class AesGcmFieldCipher implements FieldCipher {
  private readonly key: Buffer;

  constructor(base64Key: string) {
    this.key = parseFieldEncryptionKey(base64Key);
  }

  encrypt(plain: string | null, column: string): string | null {
    if (plain === null || plain === '') return plain;
    if (this.isEncrypted(plain)) return plain;
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(column));
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const parts = [iv, cipher.getAuthTag(), data].map((b) => b.toString('base64url'));
    return PREFIX + parts.join('.');
  }

  decrypt(stored: string | null, column: string): string | null {
    if (stored === null || !this.isEncrypted(stored)) return stored;
    const [iv, tag, data] = stored
      .slice(PREFIX.length)
      .split('.')
      .map((p) => Buffer.from(p, 'base64url'));
    if (!iv || !tag || !data || iv.length !== IV_BYTES) {
      throw new FieldCryptoError('Stored value is not a valid encrypted field.');
    }
    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
      decipher.setAAD(Buffer.from(column));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    } catch {
      // Wrong key, another column's value, or tampering. Never return garbage.
      throw new FieldCryptoError(`Could not decrypt ${column}: wrong key or altered value.`);
    }
  }

  isEncrypted(stored: string | null): boolean {
    return stored !== null && stored.startsWith(PREFIX);
  }
}
