import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import {
  createLeavePolicySchema,
  leavePolicyIdParamsSchema,
  updateLeavePolicySchema,
} from './policies.schemas';
import { LeavePoliciesService, PolicyCaller } from './policies.service';

function caller(req: Request): PolicyCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, requestId: req.id };
}

/** Mounted at /api/v1/leave-policies. Everyone reads (the apply form needs the types); HR and Admin write. */
export function createLeavePoliciesRouter(options: {
  service: LeavePoliciesService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('leave_policies.read'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(200).json({ data: await service.list() });
    }),
  );

  router.post(
    '/',
    requirePermission('leave_policies.manage'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createLeavePolicySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createLeavePolicySchema });
      res.status(201).json({ data: await service.create(body, caller(req)) });
    }),
  );

  router.put(
    '/:id',
    requirePermission('leave_policies.manage'),
    validate({ params: leavePolicyIdParamsSchema, body: updateLeavePolicySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: leavePolicyIdParamsSchema,
        body: updateLeavePolicySchema,
      });
      res.status(200).json({ data: await service.update(params.id, body, caller(req)) });
    }),
  );

  return router;
}
