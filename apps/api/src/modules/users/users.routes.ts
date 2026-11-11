import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate, validated } from '../../http/validate';
import { RequestContext } from '../employees/types';
import { requirePermission } from '../rbac';
import {
  createUserSchema,
  replaceRolesSchema,
  updateUserStatusSchema,
  userIdParamsSchema,
  userQueryObject,
} from './users.schemas';
import { UsersService } from './users.service';

function context(req: Request): RequestContext {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** Mounted at /api/v1/users. */
export function createUsersRouter(service: UsersService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);

  router.get(
    '/',
    requirePermission('users.list'),
    validate({ query: userQueryObject }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: userQueryObject });
      res.status(200).json(await service.list(query));
    }),
  );

  router.get(
    '/:id',
    requirePermission('users.read'),
    validate({ params: userIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: userIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id) });
    }),
  );

  router.post(
    '/',
    requirePermission('users.create'),
    validate({ body: createUserSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createUserSchema });
      const { user, temporaryPassword } = await service.createUser(body, context(req));
      res.status(201).json({
        data: user,
        ...(temporaryPassword ? { meta: { temporaryPassword } } : {}),
      });
    }),
  );

  router.put(
    '/:id/roles',
    requirePermission('users.assign_role'),
    validate({ params: userIdParamsSchema, body: replaceRolesSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: userIdParamsSchema,
        body: replaceRolesSchema,
      });
      res
        .status(200)
        .json({ data: await service.replaceRoles(params.id, body.roles, context(req)) });
    }),
  );

  router.put(
    '/:id/status',
    requirePermission('users.deactivate'),
    validate({ params: userIdParamsSchema, body: updateUserStatusSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: userIdParamsSchema,
        body: updateUserStatusSchema,
      });
      res
        .status(200)
        .json({ data: await service.updateStatus(params.id, body.isActive, context(req)) });
    }),
  );

  return router;
}

/** Mounted at /api/v1/roles. Read only: the four roles are fixed (D-21). */
export function createRolesRouter(service: UsersService, authenticate: RequestHandler): Router {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/',
    requirePermission('roles.list'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(200).json({ data: await service.listRoles() });
    }),
  );
  return router;
}

/** Mounted at /api/v1/permissions. Read only: the catalog is code (D-21). */
export function createPermissionsRouter(
  service: UsersService,
  authenticate: RequestHandler,
): Router {
  const router = Router();
  router.use(authenticate);
  router.get(
    '/',
    requirePermission('permissions.list'),
    asyncHandler(async (_req: Request, res: Response) => {
      res.status(200).json({ data: service.listPermissions() });
    }),
  );
  return router;
}
