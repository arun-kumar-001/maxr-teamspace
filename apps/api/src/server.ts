import { createApp } from './app';
import { config } from './config/env';
import { createPlatform, SqlAuditStore, SqlNotificationOutbox } from './platform';
import { getPool } from './db/client';
import { getLogger } from './logging/logger';
import { createNotificationBackgroundJobs, loadNotificationsConfig } from './modules/notifications';
import { JobRunner } from './platform/jobs/job-runner';

function startServer(): void {
  const pool = getPool();
  const platform = createPlatform({
    overrides: {
      auditStore: new SqlAuditStore(pool),
      outbox: new SqlNotificationOutbox(pool),
    },
  });
  const app = createApp({ platform });
  // Reminders and retention run on an interval; only one API instance runs a given job at a time.
  const notifications = loadNotificationsConfig();
  const jobs = new JobRunner(
    getPool,
    getLogger(),
    createNotificationBackgroundJobs({ platform, appUrl: notifications.appUrl }),
  );
  if (notifications.jobsEnabled) jobs.start(notifications.jobsIntervalMs);

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
    jobs.stop();
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
