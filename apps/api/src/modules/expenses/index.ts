import type { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import { ApprovalsService } from '../approvals';
import { PgExpensesRepository } from './expenses.repository';
import { createExpensesRouter } from './expenses.routes';
import { CompanySettingsReader, ExpensesService } from './expenses.service';
import type { IExpensesRepository } from './expenses.types';

export * from './expenses.repository';
export * from './expenses.repository.memory';
export * from './expenses.schemas';
export * from './expenses.service';
export * from './expenses.types';

export function createExpensesModule(options: {
  approvals: ApprovalsService;
  platform: PlatformServices;
  authenticate: RequestHandler;
  pool?: Pool | (() => Pool);
  settings?: CompanySettingsReader;
  repository?: IExpensesRepository;
  idempotencyStore?: IdempotencyStore;
}): {
  router: Router;
  service: ExpensesService;
} {
  const repository = options.repository ?? new PgExpensesRepository(options.pool ?? getPool);
  const service = new ExpensesService(
    repository,
    options.approvals,
    options.platform,
    options.settings,
  );

  // Register with approvals engine
  options.approvals.registerHandler(service);

  const router = createExpensesRouter({
    service,
    authenticate: options.authenticate,
    idempotencyStore: options.idempotencyStore,
  });

  return { router, service };
}
