import { RequestHandler, Router } from 'express';
import type { Pool } from 'pg';
import { getPool } from '../../db/client';
import type { PlatformServices } from '../../platform';
import { IApprovalsRepository, PgApprovalsRepository } from './approvals.repository';
import { createApprovalsRouter } from './approvals.routes';
import { ApprovalsService } from './approvals.service';

export type { ApprovalsService } from './approvals.service';
export { defaultRoute } from './approval-rules';
export type {
  Approval,
  ApprovalHandler,
  ApprovalOutcome,
  ApprovalStage,
  ApprovalTx,
  SubmitApprovalInput,
} from './approvals.types';

export interface ApprovalsServices {
  /** Mount at /api/v1/approvals. */
  router: Router;
  /** For modules: register a handler, `route`, `submit` and `cancel` inside their own transaction. */
  service: ApprovalsService;
}

export function createApprovals(options: {
  platform: Pick<PlatformServices, 'audit' | 'events'>;
  authenticate: RequestHandler;
  repository?: IApprovalsRepository;
  getPool?: () => Pool;
}): ApprovalsServices {
  const repository = options.repository ?? new PgApprovalsRepository(options.getPool ?? getPool);
  const service = new ApprovalsService(repository, options.platform);
  return { router: createApprovalsRouter(service, options.authenticate), service };
}
