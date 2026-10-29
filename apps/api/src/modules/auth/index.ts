import { RequestHandler, Router } from 'express';
import type Redis from 'ioredis';
import type { Pool } from 'pg';
import type { AuditLogger } from '../../platform';
import { AuthConfig } from './auth-config';
import { AuthController } from './auth.controller';
import { PgAuthRepository } from './auth.repository';
import { AuthRepository } from './auth.types';
import { AuthService } from './auth.service';
import { createAuthRouter } from './auth.routes';
import { createAuthenticate } from './authenticate';
import { PasswordHasher, createArgon2Hasher, createDummyHashProvider } from './password-hasher';
import { SessionService } from './session-service';
import { RedisSessionStore, SessionStore } from './session-store';

/** What the rest of the API gets from the auth module. */
export interface AuthServices {
  /** Mount at /api/v1/auth. */
  router: Router;
  /** Put in front of every protected route; sets `req.actor`. */
  authenticate: RequestHandler;
  /** Ends sessions (deactivation #26, password reset). */
  sessions: SessionService;
}

export interface CreateAuthOptions {
  config: AuthConfig;
  audit: AuditLogger;
  loginRateLimiter: RequestHandler;
  /** Defaults: PostgreSQL, Redis and Argon2id with the ADR parameters, all created lazily. */
  repo?: AuthRepository;
  store?: SessionStore;
  hasher?: PasswordHasher;
  getPool?: () => Pool;
  getRedis?: () => Redis;
  now?: () => Date;
}

export function createAuth(options: CreateAuthOptions): AuthServices {
  const { config } = options;
  const repo =
    options.repo ??
    new PgAuthRepository(
      options.getPool ??
        (() => {
          throw new Error('createAuth needs getPool or a repo');
        }),
    );
  const store =
    options.store ??
    new RedisSessionStore(
      options.getRedis ??
        (() => {
          throw new Error('createAuth needs getRedis or a store');
        }),
      config.sessionMaxAgeMs,
    );
  const hasher = options.hasher ?? createArgon2Hasher();
  const now = options.now ?? (() => new Date());

  const sessions = new SessionService(store, config, () => now().getTime());
  const service = new AuthService(
    repo,
    sessions,
    hasher,
    createDummyHashProvider(hasher),
    options.audit,
    config,
    now,
  );
  const authenticate = createAuthenticate(sessions, repo, config);
  const router = createAuthRouter({
    controller: new AuthController(service, config),
    authenticate,
    loginRateLimiter: options.loginRateLimiter,
    config,
  });

  return { router, authenticate, sessions };
}

export type { AuthConfig } from './auth-config';
export { loadAuthConfig } from './auth-config';
