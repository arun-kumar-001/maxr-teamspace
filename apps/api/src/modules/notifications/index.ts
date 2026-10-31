import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import { getLogger } from '../../logging/logger';
import type { PlatformServices } from '../../platform';
import type { Job } from '../../platform/jobs/job-runner';
import { createNotificationJobs } from './notifications.jobs';
import { INotificationsRepository, PgNotificationsRepository } from './notifications.repository';
import { createNotificationsRouter } from './notifications.routes';
import { NotificationsService } from './notifications.service';

type Platform = Pick<PlatformServices, 'audit' | 'notifications' | 'events'>;

export { loadNotificationsConfig } from './notifications.config';

function build(options: {
  platform: Platform;
  appUrl?: string;
  repository?: INotificationsRepository;
  getPool?: () => Pool;
}): NotificationsService {
  return new NotificationsService(
    options.repository ?? new PgNotificationsRepository(options.getPool ?? getPool),
    options.platform,
    getLogger(),
    options.appUrl,
  );
}

/** The inbox routes, and the subscriptions that fill it. Mount at /api/v1/notifications. */
export function createNotifications(options: {
  platform: Platform;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  appUrl?: string;
  repository?: INotificationsRepository;
  getPool?: () => Pool;
}): { router: Router; service: NotificationsService } {
  const service = build(options);
  service.subscribe(options.platform.events);
  return {
    service,
    router: createNotificationsRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}

/**
 * The background jobs (reminders, retention) for the server process. They use their own service
 * instance and do not subscribe to events: the one made by `createNotifications` already does.
 */
export function createNotificationBackgroundJobs(options: {
  platform: Platform;
  appUrl?: string;
  getPool?: () => Pool;
}): Job[] {
  return createNotificationJobs(build(options));
}
