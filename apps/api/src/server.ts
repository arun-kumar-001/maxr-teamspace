import { createApp } from './app';
import { config } from './config/env';
import { createPlatform } from './platform';

function startServer(): void {
  const platform = createPlatform();
  const app = createApp({ platform });
  // Sends queued emails in the background; stopped on shutdown.
  platform.dispatcher.start(platform.config.outbox.pollIntervalMs);

  const server = app.listen(config.PORT, config.HOST, () => {
    // eslint-disable-next-line no-console
    console.info(
      `[MAXR API] Server running on http://${config.HOST}:${config.PORT} [${config.NODE_ENV}]`,
    );
    // eslint-disable-next-line no-console
    console.info(
      `[MAXR API] Health check available at http://${config.HOST}:${config.PORT}/api/v1/health`,
    );
  });

  // Graceful shutdown handling
  const shutdown = (signal: string): void => {
    // eslint-disable-next-line no-console
    console.info(`[MAXR API] Received ${signal}. Shutting down gracefully...`);
    platform.dispatcher.stop();
    server.close(() => {
      // eslint-disable-next-line no-console
      console.info('[MAXR API] HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
