import { createHash, randomBytes } from 'node:crypto';
import { AuthConfig } from './auth-config';
import { SessionStore } from './session-store';

export interface IssuedSession {
  /** The cookie value. Shown once, never stored. */
  token: string;
  csrfToken: string;
  maxAgeMs: number;
}

export interface ResolvedSession {
  tokenHash: string;
  userId: string;
  csrfToken: string;
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/** Creates, validates and ends sessions. Idle and absolute limits are enforced here, not in the store. */
export class SessionService {
  constructor(
    private readonly store: SessionStore,
    private readonly config: Pick<AuthConfig, 'sessionIdleMs' | 'sessionMaxAgeMs'>,
    private readonly now: () => number = Date.now,
  ) {}

  async create(userId: string): Promise<IssuedSession> {
    const token = randomBytes(32).toString('base64url');
    const csrfToken = randomBytes(32).toString('base64url');
    await this.store.create(
      hashToken(token),
      { userId, csrfToken, createdAt: this.now() },
      this.config.sessionIdleMs,
    );
    return { token, csrfToken, maxAgeMs: this.config.sessionMaxAgeMs };
  }

  /** Null for anything that is not a live session: malformed, unknown, idle-expired or past its absolute limit. */
  async resolve(token: string): Promise<ResolvedSession | null> {
    if (!TOKEN_PATTERN.test(token)) return null;
    const tokenHash = hashToken(token);
    const record = await this.store.get(tokenHash);
    if (!record) return null;

    const remainingAbsolute = record.createdAt + this.config.sessionMaxAgeMs - this.now();
    if (remainingAbsolute <= 0) {
      await this.store.revoke(tokenHash);
      return null;
    }
    // Activity renews the idle window, but never beyond the absolute limit.
    await this.store.touch(tokenHash, Math.min(this.config.sessionIdleMs, remainingAbsolute));
    return { tokenHash, userId: record.userId, csrfToken: record.csrfToken };
  }

  revoke(tokenHash: string): Promise<void> {
    return this.store.revoke(tokenHash);
  }

  /** Used by deactivation (#26) and password change. */
  revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<number> {
    return this.store.revokeAllForUser(userId, exceptTokenHash);
  }
}
