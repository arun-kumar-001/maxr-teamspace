import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { IdempotencyStore, idempotent } from '../../http/idempotency';
import { validate, validated } from '../../http/validate';
import { ScopeFilter, accessFor, requirePermission, resolveScope, toScopeFilter } from '../rbac';
import {
  addMemberSchema,
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdParamsSchema,
  projectMemberParamsSchema,
  updateProjectSchema,
} from './projects.schemas';
import { ProjectCaller, ProjectsService } from './projects.service';

function caller(req: Request): ProjectCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/** The projects the caller can see (`projects.read`), for routes guarded by another permission. */
function readFilter(req: Request): ScopeFilter {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return toScopeFilter(resolveScope(actor.roles, 'projects.read'), actor);
}

/**
 * Mounted at /api/v1/projects. Reading is by visibility (owner or member; an Admin sees all);
 * changing is for the owner or an Admin. A project the caller cannot see is a 404.
 */
export function createProjectsRouter(options: {
  service: ProjectsService;
  authenticate: RequestHandler;
  idempotencyStore: IdempotencyStore;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('projects.read'),
    validate({ query: listProjectsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listProjectsQuerySchema });
      res.status(200).json(await service.list(query, accessFor(req).filter));
    }),
  );

  router.post(
    '/',
    requirePermission('projects.manage'),
    idempotent({ store: options.idempotencyStore }),
    validate({ body: createProjectSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: createProjectSchema });
      res
        .status(201)
        .json({ data: await service.create(body, caller(req), accessFor(req).filter) });
    }),
  );

  router.get(
    '/:id',
    requirePermission('projects.read'),
    validate({ params: projectIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: projectIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id, accessFor(req).filter) });
    }),
  );

  router.put(
    '/:id',
    requirePermission('projects.manage'),
    validate({ params: projectIdParamsSchema, body: updateProjectSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: projectIdParamsSchema,
        body: updateProjectSchema,
      });
      res.status(200).json({
        data: await service.update(
          params.id,
          body,
          caller(req),
          readFilter(req),
          accessFor(req).filter,
        ),
      });
    }),
  );

  router.post(
    '/:id/members',
    requirePermission('projects.manage'),
    validate({ params: projectIdParamsSchema, body: addMemberSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: projectIdParamsSchema,
        body: addMemberSchema,
      });
      res.status(200).json({
        data: await service.addMember(
          params.id,
          body.employeeId,
          caller(req),
          readFilter(req),
          accessFor(req).filter,
        ),
      });
    }),
  );

  router.delete(
    '/:id/members/:employeeId',
    requirePermission('projects.manage'),
    validate({ params: projectMemberParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: projectMemberParamsSchema });
      res.status(200).json({
        data: await service.removeMember(
          params.id,
          params.employeeId,
          caller(req),
          readFilter(req),
          accessFor(req).filter,
        ),
      });
    }),
  );

  return router;
}
