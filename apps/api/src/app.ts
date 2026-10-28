import express, { Express } from 'express';
import cors from 'cors';
import { config } from './config/env';
import { requestIdMiddleware } from './middleware/request-id';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { createTemplateRouter } from './modules/_template/template.routes';

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

  // Reusable Template Module router (scaffold demonstration)
  app.use('/api/v1/templates', createTemplateRouter());

  // 404 & Global Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
