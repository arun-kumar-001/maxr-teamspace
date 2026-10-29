import { createHash } from 'crypto';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import { conflict, unprocessable, validationError } from './errors';

export interface StoredResponse {
  status: number;
  body: unknown;
}

export interface IdempotencyRecord {
  fingerprint: string;
  response?: StoredResponse;
}

/**
 * Storage for idempotency records. The in-memory implementation below is per process;
 * a Redis implementation (SET NX with TTL) replaces it for multi-instance deployments.
 */
export interface IdempotencyStore {
  /** Atomically claims the key. Returns the existing record if the key is already taken. */
  begin(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyRecord | null>;
  complete(key: string, response: StoredResponse, ttlMs: number): Promise<void>;
  release(key: string): Promise<void>;
}

interface Entry extends IdempotencyRecord {
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  private live(key: string): Entry | undefined {
    const entry = this.entries.get(key);
    if (entry && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return entry;
  }

  async begin(key: string, fingerprint: string, ttlMs: number): Promise<IdempotencyRecord | null> {
    const existing = this.live(key);
    if (existing) {
      return { fingerprint: existing.fingerprint, response: existing.response };
    }
    this.entries.set(key, { fingerprint, expiresAt: this.now() + ttlMs });
    return null;
  }

  async complete(key: string, response: StoredResponse, ttlMs: number): Promise<void> {
    const entry = this.live(key);
    if (entry) {
      entry.response = response;
      entry.expiresAt = this.now() + ttlMs;
    }
  }

  async release(key: string): Promise<void> {
    this.entries.delete(key);
  }

  get size(): number {
    return this.entries.size;
  }
}

export interface IdempotencyOptions {
  store: IdempotencyStore;
  /** Reject requests without the header (default true). */
  required?: boolean;
  /** How long a completed response can be replayed (default 24 h). */
  ttlMs?: number;
  /**
   * Who owns the key. Keys are scoped per user so one user can never replay another user's
   * response. The auth middleware (issue #7) must run before this middleware.
   */
  actorId?: (req: Request) => string | undefined;
}

const HEADER = 'idempotency-key';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

function fingerprintOf(req: Request): string {
  return createHash('sha256')
    .update(`${req.method}\n${req.originalUrl.split('?')[0]}\n${JSON.stringify(req.body ?? null)}`)
    .digest('hex');
}

/**
 * Makes a POST safe to retry (AGENTS.md §5): the same key with the same request replays the
 * stored response instead of running the handler again.
 *
 *  - same key, same request, finished  -> stored response + `Idempotent-Replayed: true`
 *  - same key, different request       -> 422
 *  - same key while first still runs   -> 409
 *  - 5xx or aborted request            -> key released so the client can retry
 * Handlers must answer with `res.json()` so the response can be captured.
 */
export function idempotent(options: IdempotencyOptions): RequestHandler {
  const { store, required = true, ttlMs = DEFAULT_TTL_MS } = options;
  const actorOf = options.actorId ?? ((req: Request) => req.actor?.id);

  return (req: Request, res: Response, next: NextFunction): void => {
    const headerKey = req.header(HEADER);

    if (headerKey === undefined) {
      if (required) {
        next(
          validationError([
            {
              field: 'header.Idempotency-Key',
              message: 'This header is required',
              rule: 'required',
            },
          ]),
        );
      } else {
        next();
      }
      return;
    }
    if (!KEY_PATTERN.test(headerKey)) {
      next(
        validationError([
          {
            field: 'header.Idempotency-Key',
            message: 'Must be 8-128 characters: letters, digits, "-" or "_"',
            rule: 'invalid_string',
          },
        ]),
      );
      return;
    }

    const storeKey = `${req.method}:${req.baseUrl}${req.path}:${actorOf(req) ?? 'anonymous'}:${headerKey}`;
    const fingerprint = fingerprintOf(req);

    store
      .begin(storeKey, fingerprint, ttlMs)
      .then((existing) => {
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            next(unprocessable('This Idempotency-Key was already used with a different request'));
          } else if (existing.response) {
            res.setHeader('Idempotent-Replayed', 'true');
            res.status(existing.response.status).json(existing.response.body);
          } else {
            next(conflict('A request with this Idempotency-Key is still being processed'));
          }
          return;
        }

        const originalJson = res.json.bind(res);
        let settled = false;
        res.json = (body?: unknown) => {
          if (!settled) {
            settled = true;
            if (res.statusCode >= 500) {
              void store.release(storeKey);
            } else {
              void store.complete(storeKey, { status: res.statusCode, body }, ttlMs);
            }
          }
          return originalJson(body);
        };
        // Client went away or the handler never answered: free the key.
        res.on('close', () => {
          if (!settled) {
            settled = true;
            void store.release(storeKey);
          }
        });
        next();
      })
      .catch(next);
  };
}
