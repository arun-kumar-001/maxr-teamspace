import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { MAX_LINK_TTL_SECONDS } from '../platform-config';
import { isValidKey } from './keys';

const MAX_TOKEN_LENGTH = 2048;

const payloadSchema = z.object({
  /** storage key */
  k: z.string(),
  /** expiry, seconds since epoch */
  e: z.number().int(),
  /** subject: the user the link was issued to */
  s: z.string().min(1).max(128).optional(),
});

export type LinkVerification =
  | { ok: true; key: string; subject?: string; expiresAt: Date }
  | { ok: false; reason: 'malformed' | 'signature' | 'expired' | 'subject' };

export interface SignedLinkService {
  sign(input: { key: string; subject: string; ttlSeconds?: number }): {
    token: string;
    expiresAt: Date;
  };
  verify(token: string, expected?: { subject?: string }): LinkVerification;
}

export interface SignedLinkOptions {
  secret: string;
  defaultTtlSeconds?: number;
  maxTtlSeconds?: number;
  now?: () => Date;
}

const b64 = (buffer: Buffer): string => buffer.toString('base64url');

/** A random secret for development. Links stop working when the process restarts. */
export function randomSigningSecret(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Short-lived download links: `base64url(payload).base64url(HMAC-SHA256(payload))`.
 * Issue one only after the module has checked the user is allowed to read the file.
 */
export function createSignedLinkService({
  secret,
  defaultTtlSeconds = 300,
  maxTtlSeconds = MAX_LINK_TTL_SECONDS,
  now = () => new Date(),
}: SignedLinkOptions): SignedLinkService {
  if (secret.length < 32) {
    throw new Error('The signing secret must be at least 32 characters');
  }
  const mac = (data: string): Buffer => createHmac('sha256', secret).update(data).digest();

  return {
    sign({ key, subject, ttlSeconds = defaultTtlSeconds }) {
      if (!isValidKey(key)) {
        throw new Error('Invalid storage key');
      }
      if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > maxTtlSeconds) {
        throw new RangeError(`Link lifetime must be between 1 and ${maxTtlSeconds} seconds`);
      }
      const expiresAt = new Date(now().getTime() + ttlSeconds * 1000);
      const payload = b64(
        Buffer.from(
          JSON.stringify({ k: key, e: Math.floor(expiresAt.getTime() / 1000), s: subject }),
        ),
      );
      return { token: `${payload}.${b64(mac(payload))}`, expiresAt };
    },

    verify(token, expected = {}) {
      if (typeof token !== 'string' || token.length === 0 || token.length > MAX_TOKEN_LENGTH) {
        return { ok: false, reason: 'malformed' };
      }
      const parts = token.split('.');
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { ok: false, reason: 'malformed' };
      }
      const [payloadPart, signaturePart] = parts as [string, string];

      // Check the signature BEFORE reading anything inside the payload.
      const provided = Buffer.from(signaturePart, 'base64url');
      const wanted = mac(payloadPart);
      if (provided.length !== wanted.length || !timingSafeEqual(provided, wanted)) {
        return { ok: false, reason: 'signature' };
      }

      let parsed: z.infer<typeof payloadSchema>;
      try {
        parsed = payloadSchema.parse(
          JSON.parse(Buffer.from(payloadPart, 'base64url').toString('utf8')),
        );
      } catch {
        return { ok: false, reason: 'malformed' };
      }
      if (!isValidKey(parsed.k)) {
        return { ok: false, reason: 'malformed' };
      }
      if (parsed.e * 1000 <= now().getTime()) {
        return { ok: false, reason: 'expired' };
      }
      // A link issued to one user is useless to anyone else.
      if (parsed.s !== undefined && parsed.s !== expected.subject) {
        return { ok: false, reason: 'subject' };
      }
      return { ok: true, key: parsed.k, subject: parsed.s, expiresAt: new Date(parsed.e * 1000) };
    },
  };
}
