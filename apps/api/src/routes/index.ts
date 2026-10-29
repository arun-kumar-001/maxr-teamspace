import { Router } from 'express';
import { IdempotencyStore } from '../http/idempotency';
import { createTemplateRouter } from '../modules/_template/template.routes';
import { buildOpenApiDocument } from '../openapi/build-spec';

export interface ApiRouterOptions {
  idempotencyStore: IdempotencyStore;
  /** Sample module and OpenAPI document are development aids: never exposed in production. */
  exposeDevRoutes: boolean;
}

/**
 * The single /api/v1 router. Every module is mounted here, so the surface of the API can be
 * read in one place. Authentication and authorization are applied per module router (#7, #8).
 */
export function createApiRouter({ idempotencyStore, exposeDevRoutes }: ApiRouterOptions): Router {
  const router = Router();

  if (exposeDevRoutes) {
    router.use('/templates', createTemplateRouter(idempotencyStore));
    router.get('/openapi.json', (_req, res) => {
      res.status(200).json(buildOpenApiDocument());
    });
  }

  return router;
}
