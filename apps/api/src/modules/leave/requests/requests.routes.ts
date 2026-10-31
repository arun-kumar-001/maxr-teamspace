import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate, validated } from '../../../http/validate';
import { accessFor, requirePermission, resolveScope, toScopeFilter } from '../../rbac';
import {
  applyForLeaveSchema,
  leaveRequestIdParamsSchema,
  listLeaveRequestsQuerySchema,
  listMyLeaveRequestsQuerySchema,
} from './requests.schemas';
import { LeaveCaller, LeaveRequestsService } from './requests.service';

function caller(req: Request): LeaveCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/**
 * Mounted at /api/v1/leave-requests. The employee is always the signed-in caller. Decisions are
 * not here: approvers use /api/v1/approvals, which calls back into the service. `/me` is declared
 * before `/:id`.
 */
export function createLeaveRequestsRouter(options: {
  service: LeaveRequestsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.post(
    '/',
    requirePermission('leave.apply'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: applyForLeaveSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: applyForLeaveSchema });
      res.status(201).json({ data: await service.request(body, caller(req)) });
    }),
  );

  router.get(
    '/me',
    requirePermission('leave.read_own'),
    validate({ query: listMyLeaveRequestsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listMyLeaveRequestsQuerySchema });
      res.status(200).json(await service.listMine(query, caller(req)));
    }),
  );

  router.get(
    '/',
    requirePermission('leave.list'),
    validate({ query: listLeaveRequestsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listLeaveRequestsQuerySchema });
      res.status(200).json(await service.list(query, accessFor(req).filter));
    }),
  );

  router.get(
    '/:id',
    requirePermission('leave.read_own'),
    validate({ params: leaveRequestIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: leaveRequestIdParamsSchema });
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run before this handler');
      const reviewScope = toScopeFilter(resolveScope(actor.roles, 'leave.list'), actor);
      res.status(200).json({ data: await service.get(params.id, caller(req), reviewScope) });
    }),
  );

  return router;
}
