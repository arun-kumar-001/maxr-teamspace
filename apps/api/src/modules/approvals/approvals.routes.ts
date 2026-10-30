import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate, validated } from '../../http/validate';
import { accessFor, requirePermission } from '../rbac';
import {
  approvalIdParamsSchema,
  approvalQueryObject,
  approveBodySchema,
  rejectBodySchema,
} from './approvals.schemas';
import { ApprovalCaller, ApprovalsService } from './approvals.service';

function caller(req: Request): ApprovalCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, roles: actor.roles, requestId: req.id };
}

/**
 * Mounted at /api/v1/approvals. There is no route to create an approval: only the module that
 * owns a subject (leave, correction, expense) opens one, in the transaction that stores it.
 */
export function createApprovalsRouter(
  service: ApprovalsService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('approvals.list'),
    validate({ query: approvalQueryObject }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: approvalQueryObject });
      res.status(200).json(await service.list(query, caller(req), accessFor(req).filter));
    }),
  );

  router.get(
    '/:id',
    requirePermission('approvals.read'),
    validate({ params: approvalIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: approvalIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id, accessFor(req).filter) });
    }),
  );

  router.post(
    '/:id/approve',
    requirePermission('approvals.decide'),
    validate({ params: approvalIdParamsSchema, body: approveBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: approvalIdParamsSchema,
        body: approveBodySchema,
      });
      const approval = await service.decide(
        params.id,
        'approved',
        body.comment,
        caller(req),
        accessFor(req).filter,
      );
      res.status(200).json({ data: approval });
    }),
  );

  router.post(
    '/:id/reject',
    requirePermission('approvals.decide'),
    validate({ params: approvalIdParamsSchema, body: rejectBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: approvalIdParamsSchema,
        body: rejectBodySchema,
      });
      const approval = await service.decide(
        params.id,
        'rejected',
        body.comment,
        caller(req),
        accessFor(req).filter,
      );
      res.status(200).json({ data: approval });
    }),
  );

  return router;
}
