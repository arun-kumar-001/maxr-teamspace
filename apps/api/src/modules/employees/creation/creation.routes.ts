import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../../http/idempotency';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import { createEmployeeSchema } from './creation.schemas';
import { EmployeeCreationService } from './creation.service';

/**
 * `POST /api/v1/employees`. Mounted next to the directory router on the same path; this file
 * only adds the write. The caller's roles come from the session, never from the body.
 */
export function createEmployeeCreationRouter(options: {
  service: EmployeeCreationService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const router = Router();

  router.post(
    '/',
    options.authenticate,
    requirePermission('employees.create'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createEmployeeSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run before this handler');
      const { body } = validated(req, { body: createEmployeeSchema });
      const created = await options.service.create(body, {
        actorId: actor.id,
        roles: actor.roles,
        requestId: req.id,
      });
      res.status(201).json({ data: created });
    }),
  );

  return router;
}
