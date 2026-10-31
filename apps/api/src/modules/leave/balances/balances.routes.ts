import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { accessFor, requirePermission } from '../../rbac';
import {
  accrualBodySchema,
  listBalancesQuerySchema,
  myBalancesQuerySchema,
} from './balances.schemas';
import { BalanceCaller, LeaveBalancesService } from './balances.service';

function caller(req: Request): BalanceCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** Mounted at /api/v1/leave-balances. `/me` and `/accrual` are fixed paths, declared before anything with a parameter. */
export function createLeaveBalancesRouter(options: {
  service: LeaveBalancesService;
  authenticate: RequestHandler;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/me',
    requirePermission('leave.read_own'),
    validate({ query: myBalancesQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: myBalancesQuerySchema });
      res.status(200).json({ data: await service.mine(caller(req).employeeId, query.year) });
    }),
  );

  router.get(
    '/',
    requirePermission('leave_balances.list'),
    validate({ query: listBalancesQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listBalancesQuerySchema });
      res.status(200).json(await service.list(query, accessFor(req).filter));
    }),
  );

  router.post(
    '/accrual',
    requirePermission('leave_balances.accrue'),
    validate({ body: accrualBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: accrualBodySchema });
      res.status(200).json({ data: await service.accrue(body.year, caller(req)) });
    }),
  );

  return router;
}
