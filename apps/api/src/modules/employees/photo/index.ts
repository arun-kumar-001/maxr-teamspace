import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import type { PlatformServices } from '../../../platform';
import { createEmployeePhotoRouter } from './photo.routes';
import { PgEmployeePhotoRepository } from './photo.repository';
import { EmployeePhotoService } from './photo.service';
import type { IEmployeePhotoRepository } from './photo.types';

/** Own profile photo (`/employees/me/photo`) and viewing one (`/employees/{id}/photo`). */
export function createEmployeePhoto(options: {
  platform: Pick<PlatformServices, 'audit' | 'storage'>;
  authenticate: RequestHandler;
  repository?: IEmployeePhotoRepository;
  getPool?: () => Pool;
}): { router: Router } {
  const repository =
    options.repository ?? new PgEmployeePhotoRepository(options.getPool ?? getPool);
  const service = new EmployeePhotoService(repository, options.platform);
  return { router: createEmployeePhotoRouter({ service, authenticate: options.authenticate }) };
}
