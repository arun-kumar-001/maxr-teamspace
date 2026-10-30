import cors from 'cors';
import express, { Express } from 'express';
import { config } from './config/env';
import { checkDatabaseHealth } from './db/client';
import { checkRedisHealth } from './db/redis';
import { HealthDependencies, createHealthHandler } from './health/health';
import { HttpConfig, loadHttpConfig } from './http/http-config';
import { InMemoryIdempotencyStore } from './http/idempotency';
import { createRateLimiter } from './http/rate-limit';
import { Logger, getLogger } from './logging/logger';
import { requestLogger } from './logging/request-logger';
import { createErrorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestIdMiddleware } from './middleware/request-id';
import { Platform, createPlatform } from './platform';
import { AuthServices, createAuth, loadAuthConfig } from './modules/auth';
import { createApiRouter } from './routes';
import { getPool } from './db/client';
import { getRedisClient } from './db/redis';

export interface AppOptions {
  logger?: Logger;
  http?: HttpConfig;
  /** Defaults to the validated NODE_ENV. */
  nodeEnv?: string;
  /** Dependency probes for /api/v1/health; defaults to the real PostgreSQL and Redis checks. */
  health?: HealthDependencies;
  /** Shared services (audit, events, notifications, storage). Defaults to the environment-configured ones. */
  platform?: Platform;
  /** Sign-in, sessions and the `authenticate` middleware. Defaults to PostgreSQL + Redis + Argon2id. */
  auth?: AuthServices;
}

export function createApp(options: AppOptions = {}): Express {
  const logger = options.logger ?? getLogger();
  const http = options.http ?? loadHttpConfig();
  const nodeEnv = options.nodeEnv ?? config.NODE_ENV;
  const platform = options.platform ?? createPlatform({ logger });
  const auth =
    options.auth ??
    createAuth({
      config: loadAuthConfig(process.env, nodeEnv, config.CORS_ORIGIN),
      audit: platform.audit,
      loginRateLimiter: createRateLimiter(http.loginRateLimit),
      getPool,
      getRedis: getRedisClient,
    });

  const app = express();
  app.disable('x-powered-by');

  // Behind Nginx the client IP comes from X-Forwarded-For; rate limiting needs the right hop count.
  app.set('trust proxy', http.trustProxy);

  // Request id first so every later log line and error carries it.
  app.use(requestIdMiddleware);
  app.use(requestLogger(logger));

  // Security & Core Middleware
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-Request-Id', 'Idempotency-Key', 'X-CSRF-Token'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    createRateLimiter({
      ...http.rateLimit,
      skip: (req) => req.path === '/api/v1/health',
    }),
  );

  // Health check endpoint (single route; rate limiter skips it)
  app.get(
    '/api/v1/health',
    createHealthHandler(
      options.health ?? {
        checkDatabase: () => checkDatabaseHealth(logger),
        checkRedis: () => checkRedisHealth(logger),
      },
      logger,
    ),
  );

  app.use(
    '/api/v1',
    createApiRouter({
      idempotencyStore: new InMemoryIdempotencyStore(),
      platform,
      auth,
      exposeDevRoutes: nodeEnv !== 'production',
    }),
  );

  // 404 & Global Error Handlers
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
