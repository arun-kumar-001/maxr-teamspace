import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { accessFor, requirePermission } from '../../rbac';
import { updateEmployeeSchema } from './detail.schemas';
import { DetailCaller, EmployeeDetailService } from './detail.service';

function caller(req: Request): DetailCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, roles: actor.roles, requestId: req.id };
}

/**
 * `GET` and `PUT /api/v1/employees/{id}`. Mounted on `/employees` next to the directory and
 * creation routers. `/employees/me` (#22) must be registered before this router.
 */
export function createEmployeeDetailRouter(options: {
  service: EmployeeDetailService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();

  router.get(
    '/:id',
    options.authenticate,
    requirePermission('employees.read'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: idParamSchema });
      const detail = await options.service.get(params.id, accessFor(req).filter, caller(req));
      res.status(200).json({ data: detail });
    }),
  );

  router.put(
    '/:id',
    options.authenticate,
    requirePermission('employees.update'),
    validate({ params: idParamSchema, body: updateEmployeeSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: idParamSchema,
        body: updateEmployeeSchema,
      });
      const detail = await options.service.update(
        params.id,
        body,
        caller(req),
        accessFor(req).filter,
      );
      res.status(200).json({ data: detail });
    }),
  );

  return router;
}
