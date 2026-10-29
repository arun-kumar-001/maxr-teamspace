import cors from 'cors';
import express, { Express } from 'express';
import { config } from './config/env';
import { HttpConfig, loadHttpConfig } from './http/http-config';
import { InMemoryIdempotencyStore } from './http/idempotency';
import { createRateLimiter } from './http/rate-limit';
import { Logger, getLogger } from './logging/logger';
import { requestLogger } from './logging/request-logger';
import { createErrorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { requestIdMiddleware } from './middleware/request-id';
import { createApiRouter } from './routes';

export interface AppOptions {
  logger?: Logger;
  http?: HttpConfig;
  /** Defaults to the validated NODE_ENV. */
  nodeEnv?: string;
}

export function createApp(options: AppOptions = {}): Express {
  const logger = options.logger ?? getLogger();
  const http = options.http ?? loadHttpConfig();
  const nodeEnv = options.nodeEnv ?? config.NODE_ENV;

  const app = express();

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
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(
    createRateLimiter({
      ...http.rateLimit,
      skip: (req) => req.path === '/api/v1/health',
    }),
  );

  // Health check endpoint
  app.get('/api/v1/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'maxr-api',
      version: '0.1.0',
      environment: config.NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  });

  app.use(
    '/api/v1',
    createApiRouter({
      idempotencyStore: new InMemoryIdempotencyStore(),
      exposeDevRoutes: nodeEnv !== 'production',
    }),
  );

  // 404 & Global Error Handlers
  app.use(notFoundHandler);
  app.use(createErrorHandler(logger));

  return app;
}
