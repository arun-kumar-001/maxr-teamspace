import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../../db/client';
import { IdempotencyStore } from '../../../http/idempotency';
import type { PlatformServices } from '../../../platform';
import type { ApprovalsService } from '../../approvals';
import type { CompanySettingsReader } from '../../settings';
import type { ShiftResolver } from '../../shifts';
import { ICorrectionsRepository, PgCorrectionsRepository } from './corrections.repository';
import { createCorrectionsRouter } from './corrections.routes';
import { AttendanceCorrectionsService } from './corrections.service';

export interface AttendanceCorrections {
  /** Mount at /api/v1/attendance/corrections, before the attendance router. */
  router: Router;
}

/** Builds the module and registers its decision handler with the approvals engine. */
export function createAttendanceCorrections(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  approvals: ApprovalsService;
  settings: CompanySettingsReader;
  shiftResolver: ShiftResolver | undefined;
  repository?: ICorrectionsRepository;
  getPool?: () => Pool;
  clock?: () => Date;
}): AttendanceCorrections {
  const repository = options.repository ?? new PgCorrectionsRepository(options.getPool ?? getPool);
  const service = new AttendanceCorrectionsService(
    repository,
    options.approvals,
    options.platform,
    options.settings,
    options.shiftResolver,
    options.clock,
  );
  options.approvals.registerHandler(service);
  return {
    router: createCorrectionsRouter({
      service,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
  };
}
