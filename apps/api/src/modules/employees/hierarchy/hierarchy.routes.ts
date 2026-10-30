import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { accessFor, requirePermission } from '../../rbac';
import { changeManagerSchema, orgListQuerySchema } from './hierarchy.schemas';
import { HierarchyCaller, HierarchyService } from './hierarchy.service';

function caller(req: Request): HierarchyCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/**
 * `GET /employees/org-roots`, `GET /employees/{id}/direct-reports` and `PUT /employees/{id}/manager`.
 * Mounted on `/employees` BEFORE the detail router, so `org-roots` is not read as an id.
 */
export function createHierarchyRouter(options: {
  service: HierarchyService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const { service, authenticate } = options;

  router.get(
    '/org-roots',
    authenticate,
    requirePermission('employees.list'),
    validate({ query: orgListQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: orgListQuerySchema });
      res.status(200).json(await service.roots(query, accessFor(req).filter));
    }),
  );

  router.get(
    '/:id/direct-reports',
    authenticate,
    requirePermission('employees.list'),
    validate({ params: idParamSchema, query: orgListQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, query } = validated(req, {
        params: idParamSchema,
        query: orgListQuerySchema,
      });
      res
        .status(200)
        .json(await service.directReports(params.id, query, accessFor(req).filter, caller(req)));
    }),
  );

  router.put(
    '/:id/manager',
    authenticate,
    requirePermission('employees.update'),
    validate({ params: idParamSchema, body: changeManagerSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: idParamSchema,
        body: changeManagerSchema,
      });
      const change = await service.changeManager(
        params.id,
        body,
        caller(req),
        accessFor(req).filter,
      );
      res.status(200).json({ data: change });
    }),
  );

  return router;
}
