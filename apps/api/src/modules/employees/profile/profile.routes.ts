import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import { updateProfileSchema } from './profile.schemas';
import { ProfileCaller, ProfileService } from './profile.service';

function caller(req: Request): ProfileCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, roles: actor.roles, requestId: req.id };
}

/** `GET` and `PUT /api/v1/employees/me`. Mount on `/employees` BEFORE the detail router (`/:id`). */
export function createProfileRouter(options: {
  service: ProfileService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const { service, authenticate } = options;

  router.get(
    '/me',
    authenticate,
    requirePermission('profile.read'),
    asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json({ data: await service.get(caller(req)) });
    }),
  );

  router.put(
    '/me',
    authenticate,
    requirePermission('profile.update'),
    validate({ body: updateProfileSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: updateProfileSchema });
      res.status(200).json({ data: await service.update(body, caller(req)) });
    }),
  );

  return router;
}
