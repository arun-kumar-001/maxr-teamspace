import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import { deactivateBodySchema } from './deactivation.schemas';
import { EmployeeDeactivationService } from './deactivation.service';

/** `POST /api/v1/employees/{id}/deactivate`. Admin only (D-23). */
export function createEmployeeDeactivationRouter(options: {
  service: EmployeeDeactivationService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();

  router.post(
    '/:id/deactivate',
    options.authenticate,
    requirePermission('employees.deactivate'),
    validate({ params: idParamSchema, body: deactivateBodySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run before this handler');
      const { params } = validated(req, { params: idParamSchema, body: deactivateBodySchema });
      const result = await options.service.deactivate(params.id, {
        actorId: actor.id,
        employeeId: actor.employeeId,
        requestId: req.id,
      });
      res.status(200).json({ data: result });
    }),
  );

  return router;
}
