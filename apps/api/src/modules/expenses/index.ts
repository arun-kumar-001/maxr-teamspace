import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import type { ApprovalsService } from '../approvals';
import type { CompanySettingsReader } from '../settings';
import { createExpensesRouters } from './expenses.routes';
import { ExpensesService } from './expenses.service';
import { IExpensesRepository, PgExpensesRepository } from './expenses.repository';

export interface ExpensesModule {
  /** Mount at /api/v1/expense-claims. */
  claimsRouter: Router;
  /** Mount at /api/v1/expense-categories. */
  categoriesRouter: Router;
  service: ExpensesService;
}

/** Expense claims register their decision handler with the approvals engine here. */
export function createExpenses(options: {
  platform: Pick<PlatformServices, 'audit' | 'events' | 'storage'>;
  approvals: ApprovalsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  settings: CompanySettingsReader;
  repository?: IExpensesRepository;
  getPool?: () => Pool;
  clock?: () => Date;
}): ExpensesModule {
  const repository = options.repository ?? new PgExpensesRepository(options.getPool ?? getPool);
  const service = new ExpensesService(
    repository,
    options.approvals,
    options.platform,
    options.settings,
    options.clock,
  );
  options.approvals.registerHandler(service);
  const { claimsRouter, categoriesRouter } = createExpensesRouters({
    service,
    authenticate: options.authenticate,
    idempotencyStore: options.idempotencyStore,
  });
  return { claimsRouter, categoriesRouter, service };
}
