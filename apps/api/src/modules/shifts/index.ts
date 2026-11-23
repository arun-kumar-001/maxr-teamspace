import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import type { CompanySettingsReader } from '../settings';
import { IShiftsRepository, PgShiftsRepository } from './shifts.repository';
import { createPolicyRouter, createShiftsRouter } from './shifts.routes';
import { ShiftsService } from './shifts.service';

export type { ShiftResolver, ShiftSummary } from './shifts.types';

export interface ShiftsServices {
  /** Mount at /api/v1/shifts. */
  shiftsRouter: Router;
  /** Mount at /api/v1/attendance/policies, before the attendance router. */
  policyRouter: Router;
  /** For attendance, leave and reports: which shift applies to an employee on a date. */
  resolver: import('./shifts.types').ShiftResolver;
}

export function createShifts(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  settings: CompanySettingsReader;
  repository?: IShiftsRepository;
  getPool?: () => Pool;
}): ShiftsServices {
  const repository = options.repository ?? new PgShiftsRepository(options.getPool ?? getPool);
  const service = new ShiftsService(repository, options.platform, options.settings);
  return {
    shiftsRouter: createShiftsRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
    policyRouter: createPolicyRouter({ service, authenticate: options.authenticate }),
    resolver: service,
  };
}
