import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import { IdempotencyStore } from '../../http/idempotency';
import type { PlatformServices } from '../../platform';
import type { ApprovalsService } from '../approvals';
import type { CompanySettingsReader } from '../settings';
import {
  ILeaveBalancesRepository,
  PgLeaveBalancesRepository,
} from './balances/balances.repository';
import { createLeaveBalancesRouter } from './balances/balances.routes';
import { LeaveBalancesService } from './balances/balances.service';
import { IHolidaysRepository, PgHolidaysRepository } from './holidays/holidays.repository';
import { createHolidaysRouter } from './holidays/holidays.routes';
import { HolidaysService } from './holidays/holidays.service';
import type { HolidayReader } from './holidays/holidays.types';
import {
  ILeavePoliciesRepository,
  PgLeavePoliciesRepository,
} from './policies/policies.repository';
import { createLeavePoliciesRouter } from './policies/policies.routes';
import { LeavePoliciesService } from './policies/policies.service';
import {
  ILeaveRequestsRepository,
  PgLeaveRequestsRepository,
} from './requests/requests.repository';
import { createLeaveRequestsRouter } from './requests/requests.routes';
import { LeaveRequestsService } from './requests/requests.service';
import type { LeaveTx } from './policies/policies.types';

export type { HolidayReader } from './holidays/holidays.types';

export interface LeaveSetup {
  /** Mount at /api/v1/leave-policies. */
  policiesRouter: Router;
  /** Mount at /api/v1/holidays. */
  holidaysRouter: Router;
  /** Mount at /api/v1/leave-balances. */
  balancesRouter: Router;
  /** Mount at /api/v1/leave-requests. */
  requestsRouter: Router;
  /** For leave requests and reports: the holiday dates. */
  holidays: HolidayReader;
  /** For employee creation: gives a joiner their balances inside its transaction. */
  initializeBalances(tx: LeaveTx, employeeId: string, joiningDate: string): Promise<void>;
}

export function createLeaveSetup(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  /** Leave requests open an approval and register their decision handler with it. */
  approvals: ApprovalsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
  settings: CompanySettingsReader;
  policiesRepository?: ILeavePoliciesRepository;
  holidaysRepository?: IHolidaysRepository;
  balancesRepository?: ILeaveBalancesRepository;
  requestsRepository?: ILeaveRequestsRepository;
  getPool?: () => Pool;
  clock?: () => Date;
}): LeaveSetup {
  const pool = options.getPool ?? getPool;
  const policies = new LeavePoliciesService(
    options.policiesRepository ?? new PgLeavePoliciesRepository(pool),
    options.platform,
  );
  const holidays = new HolidaysService(
    options.holidaysRepository ?? new PgHolidaysRepository(pool),
    options.platform,
    options.settings,
    options.clock,
  );
  const balances = new LeaveBalancesService(
    options.balancesRepository ?? new PgLeaveBalancesRepository(pool),
    options.platform,
    options.settings,
    options.clock,
  );
  const requests = new LeaveRequestsService(
    options.requestsRepository ?? new PgLeaveRequestsRepository(pool),
    options.approvals,
    options.platform,
    options.settings,
    holidays,
    policies,
    options.clock,
  );
  options.approvals.registerHandler(requests);
  return {
    policiesRouter: createLeavePoliciesRouter({
      service: policies,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
    holidaysRouter: createHolidaysRouter({
      service: holidays,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
    requestsRouter: createLeaveRequestsRouter({
      service: requests,
      authenticate: options.authenticate,
      idempotencyStore: options.idempotencyStore,
    }),
    balancesRouter: createLeaveBalancesRouter({
      service: balances,
      authenticate: options.authenticate,
    }),
    holidays,
    initializeBalances: (tx, employeeId, joiningDate) =>
      balances.initializeForJoiner(tx, employeeId, joiningDate),
  };
}
