import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createTemplateRouter } from './modules/_template/template.routes';
import { checkDatabaseHealth } from './db/client';
import { checkRedisHealth } from './db/redis';

export function createApp(): Express {
  const app = express();

  // Security & Core Middleware
  app.use(
    cors({
      origin: config.CORS_ORIGIN,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  // Health check handler checking application status & dependencies
  const healthHandler = async (_req: Request, res: Response): Promise<void> => {
    const [dbHealth, redisHealth] = await Promise.all([checkDatabaseHealth(), checkRedisHealth()]);

    const isHealthy = dbHealth.status === 'up';
    const overallStatus = isHealthy && redisHealth.status === 'up' ? 'healthy' : 'degraded';

    const statusCode = isHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      service: 'maxr-api',
      version: '0.1.0',
      environment: config.NODE_ENV,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      dependencies: {
        database: dbHealth,
        redis: redisHealth,
      },
    });
  };

  // Support both /api/health and /api/v1/health per conventions
  app.get('/api/health', healthHandler);
  app.get('/api/v1/health', healthHandler);

  // Reusable Template Module router (scaffold demonstration)
  app.use('/api/v1/templates', createTemplateRouter());

  // 404 & Global Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
