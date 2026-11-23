import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate, validated } from '../../../http/validate';
import { requirePermission, resolveScope, toScopeFilter } from '../../rbac';
import {
  correctionIdParamsSchema,
  listCorrectionsQuerySchema,
  requestCorrectionSchema,
} from './corrections.schemas';
import { AttendanceCorrectionsService, CorrectionCaller } from './corrections.service';

function caller(req: Request): CorrectionCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/**
 * Mounted at /api/v1/attendance/corrections, BEFORE the attendance router. The employee is always
 * the signed-in caller; the body never names one. Decisions are not here: approvers use
 * /api/v1/approvals, which calls back into the service when the last step is decided.
 */
export function createCorrectionsRouter(options: {
  service: AttendanceCorrectionsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.post(
    '/',
    requirePermission('attendance.request_correction'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: requestCorrectionSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: requestCorrectionSchema });
      res.status(201).json({ data: await service.request(body, caller(req)) });
    }),
  );

  router.get(
    '/',
    requirePermission('attendance.read_own'),
    validate({ query: listCorrectionsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listCorrectionsQuerySchema });
      res.status(200).json(await service.list(query, caller(req)));
    }),
  );

  router.get(
    '/:id',
    requirePermission('attendance.read_own'),
    validate({ params: correctionIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: correctionIdParamsSchema });
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run before this handler');
      const reviewScope = toScopeFilter(
        resolveScope(actor.roles, 'attendance.approve_correction'),
        actor,
      );
      res.status(200).json({ data: await service.get(params.id, caller(req), reviewScope) });
    }),
  );

  router.post(
    '/:id/cancel',
    requirePermission('attendance.request_correction'),
    validate({ params: correctionIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: correctionIdParamsSchema });
      res.status(200).json({ data: await service.cancel(params.id, caller(req)) });
    }),
  );

  return router;
}
