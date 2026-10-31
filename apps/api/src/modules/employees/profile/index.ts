import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { PgEmployeeDetailRepository } from '../detail/detail.repository';
import { IEmployeeDetailRepository } from '../detail/detail.repository';
import { EmployeeDetailService } from '../detail/detail.service';
import { createProfileRouter } from './profile.routes';
import { ProfileService } from './profile.service';

/** `GET` and `PUT /employees/me`. Mount on `/employees` BEFORE the hierarchy and detail routers. */
export function createEmployeeProfile(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IEmployeeDetailRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository =
    options.repository ?? new PgEmployeeDetailRepository(options.getPool ?? getPool);
  const service = new ProfileService(new EmployeeDetailService(repository, options.platform));
  return { router: createProfileRouter({ service, authenticate: options.authenticate }) };
}
