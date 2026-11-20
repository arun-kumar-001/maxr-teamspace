import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { AesGcmFieldCipher, FieldCryptoError, parseFieldEncryptionKey } from './field-crypto';

const newKey = () => randomBytes(32).toString('base64');

describe('AesGcmFieldCipher', () => {
  const cipher = new AesGcmFieldCipher(newKey());
  const COL = 'employees.pan_number';

  it('round-trips a value and never stores it readable', () => {
    const stored = cipher.encrypt('ABCDE1234F', COL) as string;
    expect(stored).toMatch(/^enc:v1:/);
    expect(stored).not.toContain('ABCDE1234F');
    expect(cipher.decrypt(stored, COL)).toBe('ABCDE1234F');
  });

  it('round-trips non-ASCII text', () => {
    const stored = cipher.encrypt('खाता-१२३', COL);
    expect(cipher.decrypt(stored, COL)).toBe('खाता-१२३');
  });

  it('gives a different ciphertext each time, so equal numbers cannot be spotted', () => {
    expect(cipher.encrypt('same', COL)).not.toBe(cipher.encrypt('same', COL));
  });

  it('leaves null and the empty string alone', () => {
    expect(cipher.encrypt(null, COL)).toBeNull();
    expect(cipher.encrypt('', COL)).toBe('');
    expect(cipher.decrypt(null, COL)).toBeNull();
    expect(cipher.decrypt('', COL)).toBe('');
  });

  it('does not encrypt twice', () => {
    const once = cipher.encrypt('1234', COL) as string;
    expect(cipher.encrypt(once, COL)).toBe(once);
  });

  it('reads a value stored before encryption existed, unchanged', () => {
    expect(cipher.decrypt('ABCDE1234F', COL)).toBe('ABCDE1234F');
    expect(cipher.isEncrypted('ABCDE1234F')).toBe(false);
  });

  it('refuses a value encrypted under another key', () => {
    const stored = new AesGcmFieldCipher(newKey()).encrypt('secret', COL);
    expect(() => cipher.decrypt(stored, COL)).toThrow(FieldCryptoError);
  });

  it('refuses a value moved into another column', () => {
    const stored = cipher.encrypt('123412341234', 'employees.aadhaar_number');
    expect(() => cipher.decrypt(stored, 'employees.bank_account_number')).toThrow(FieldCryptoError);
  });

  it('refuses a value that was altered', () => {
    const stored = cipher.encrypt('123412341234', COL) as string;
    const last = stored.slice(-1) === 'A' ? 'B' : 'A';
    expect(() => cipher.decrypt(stored.slice(0, -1) + last, COL)).toThrow(FieldCryptoError);
  });

  it('refuses a malformed encrypted value without leaking anything', () => {
    expect(() => cipher.decrypt('enc:v1:nonsense', COL)).toThrow(FieldCryptoError);
  });
});

describe('parseFieldEncryptionKey', () => {
  it('accepts exactly 32 bytes', () => {
    expect(parseFieldEncryptionKey(newKey())).toHaveLength(32);
  });
  it.each([
    [''],
    ['abc'],
    [randomBytes(31).toString('base64')],
    [randomBytes(33).toString('base64')],
  ])('rejects %j', (raw) => {
    expect(() => parseFieldEncryptionKey(raw)).toThrow(FieldCryptoError);
  });
});
