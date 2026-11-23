import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import { IdempotencyStore } from '../../../http/idempotency';
import type { PlatformServices } from '../../../platform';
import { PasswordHasher, createArgon2Hasher } from '../../auth/password-hasher';
import { IEmployeeCreationRepository, PgEmployeeCreationRepository } from './creation.repository';
import { createEmployeeCreationRouter } from './creation.routes';
import type { CreatedEmployee, CreationTx } from './creation.types';
import { EmployeeCreationService } from './creation.service';

/** `POST /employees`. Mount it on `/employees` next to the directory router. */
export function createEmployeeCreation(options: {
  platform: Pick<PlatformServices, 'audit' | 'events' | 'notifications'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  repository?: IEmployeeCreationRepository;
  hasher?: PasswordHasher;
  getPool?: () => Pool;
  /** See `EmployeeCreationService`: runs inside the creation transaction. */
  afterCreate?: (tx: CreationTx, employee: CreatedEmployee) => Promise<void>;
}): { router: Router } {
  const repository =
    options.repository ?? new PgEmployeeCreationRepository(options.getPool ?? getPool);
  const service = new EmployeeCreationService(
    repository,
    options.platform,
    options.hasher ?? createArgon2Hasher(),
    undefined,
    options.afterCreate,
  );
  return {
    router: createEmployeeCreationRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}
