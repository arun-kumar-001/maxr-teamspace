import type Redis from 'ioredis';

export interface SessionRecord {
  userId: string;
  csrfToken: string;
  /** Epoch ms; the absolute lifetime is counted from here. */
  createdAt: number;
}

/** Sessions are looked up by the SHA-256 of the cookie token, so a leaked store holds no usable tokens. */
export interface SessionStore {
  create(tokenHash: string, record: SessionRecord, ttlMs: number): Promise<void>;
  get(tokenHash: string): Promise<SessionRecord | null>;
  /** Moves the idle expiry. */
  touch(tokenHash: string, ttlMs: number): Promise<void>;
  revoke(tokenHash: string): Promise<void>;
  /** Ends every session of a user (deactivation, password change); returns how many ended. */
  revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<number>;
}

interface MemoryEntry extends SessionRecord {
  expiresAt: number;
}

export class InMemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, MemoryEntry>();

  constructor(private readonly now: () => number = Date.now) {}

  async create(tokenHash: string, record: SessionRecord, ttlMs: number): Promise<void> {
    this.sessions.set(tokenHash, { ...record, expiresAt: this.now() + ttlMs });
  }

  async get(tokenHash: string): Promise<SessionRecord | null> {
    const entry = this.sessions.get(tokenHash);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.sessions.delete(tokenHash);
      return null;
    }
    const { expiresAt: _expiresAt, ...record } = entry;
    return record;
  }

  async touch(tokenHash: string, ttlMs: number): Promise<void> {
    const entry = this.sessions.get(tokenHash);
    if (entry && entry.expiresAt > this.now()) entry.expiresAt = this.now() + ttlMs;
  }

  async revoke(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<number> {
    let count = 0;
    for (const [hash, entry] of this.sessions) {
      if (entry.userId === userId && hash !== exceptTokenHash) {
        this.sessions.delete(hash);
        if (entry.expiresAt > this.now()) count += 1;
      }
    }
    return count;
  }
}

const SESSION_PREFIX = 'maxr:sess:';
const USER_PREFIX = 'maxr:user-sess:';

/** Redis keeps the sessions (ADR D-05). Redis runs with append-only persistence, so a restart keeps them. */
export class RedisSessionStore implements SessionStore {
  /** `getClient` is lazy so building the app opens no connection. */
  constructor(
    private readonly getClient: () => Redis,
    private readonly maxAgeMs: number,
  ) {}

  async create(tokenHash: string, record: SessionRecord, ttlMs: number): Promise<void> {
    const redis = this.getClient();
    await redis
      .multi()
      .set(SESSION_PREFIX + tokenHash, JSON.stringify(record), 'PX', ttlMs)
      .sadd(USER_PREFIX + record.userId, tokenHash)
      .pexpire(USER_PREFIX + record.userId, this.maxAgeMs)
      .exec();
  }

  async get(tokenHash: string): Promise<SessionRecord | null> {
    const raw = await this.getClient().get(SESSION_PREFIX + tokenHash);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as Partial<SessionRecord>;
      if (
        typeof parsed.userId === 'string' &&
        typeof parsed.csrfToken === 'string' &&
        typeof parsed.createdAt === 'number'
      ) {
        return { userId: parsed.userId, csrfToken: parsed.csrfToken, createdAt: parsed.createdAt };
      }
    } catch {
      // A corrupt entry is treated as no session.
    }
    return null;
  }

  async touch(tokenHash: string, ttlMs: number): Promise<void> {
    await this.getClient().pexpire(SESSION_PREFIX + tokenHash, ttlMs);
  }

  async revoke(tokenHash: string): Promise<void> {
    const redis = this.getClient();
    const record = await this.get(tokenHash);
    const pipeline = redis.multi().del(SESSION_PREFIX + tokenHash);
    if (record) pipeline.srem(USER_PREFIX + record.userId, tokenHash);
    await pipeline.exec();
  }

  async revokeAllForUser(userId: string, exceptTokenHash?: string): Promise<number> {
    const redis = this.getClient();
    const hashes = (await redis.smembers(USER_PREFIX + userId)).filter(
      (h) => h !== exceptTokenHash,
    );
    if (hashes.length === 0) return 0;
    const pipeline = redis.multi();
    for (const hash of hashes) {
      pipeline.del(SESSION_PREFIX + hash);
      pipeline.srem(USER_PREFIX + userId, hash);
    }
    const results = await pipeline.exec();
    // Every second command is a DEL; count the ones that removed a live session.
    return (results ?? []).filter(([, value], index) => index % 2 === 0 && value === 1).length;
  }
}
