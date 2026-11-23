import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import type { PlatformServices } from '../../platform';
import type { Job } from '../../platform/jobs/job-runner';
import { IMeetingsRepository, PgMeetingsRepository } from './meetings.repository';
import { createMeetingsRouter } from './meetings.routes';
import { MeetingsService } from './meetings.service';

export interface MeetingsModule {
  /** Mount at /api/v1/meetings. */
  router: Router;
  service: MeetingsService;
  /** The reminder job (D-18) for the server process. */
  jobs: Job[];
}

export function createMeetings(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IMeetingsRepository;
  getPool?: () => Pool;
  clock?: () => Date;
}): MeetingsModule {
  const repository = options.repository ?? new PgMeetingsRepository(options.getPool ?? getPool);
  const service = new MeetingsService(repository, options.platform, options.clock);
  return {
    service,
    router: createMeetingsRouter({ service, authenticate: options.authenticate }),
    jobs: [
      { name: 'meeting-reminders', run: async (now) => void (await service.sendReminders(now)) },
    ],
  };
}

/** The reminder job for the server process, with its own service (no routes, no event subscriptions). */
export function createMeetingBackgroundJobs(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  getPool?: () => Pool;
}): Job[] {
  return createMeetings({
    platform: options.platform,
    authenticate: (_req, _res, next) => next(),
    getPool: options.getPool,
  }).jobs;
}
