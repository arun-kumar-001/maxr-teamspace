import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { rawUploadParser, readRawUpload } from '../../../http/raw-upload';
import { validate, validated } from '../../../http/validate';
import { accessFor, requirePermission } from '../../rbac';
import { EmployeePhotoService, type PhotoCaller } from './photo.service';

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function caller(req: Request): PhotoCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, roles: actor.roles, requestId: req.id };
}

/**
 * `PUT` and `DELETE /api/v1/employees/me/photo`, and `GET /api/v1/employees/{id}/photo`.
 * Mount on `/employees` BEFORE the detail router (`/:id`).
 */
export function createEmployeePhotoRouter(options: {
  service: EmployeePhotoService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();
  const { service, authenticate } = options;

  router.put(
    '/me/photo',
    authenticate,
    requirePermission('profile.update'),
    rawUploadParser(MAX_PHOTO_BYTES),
    asyncHandler(async (req: Request, res: Response) => {
      res.status(200).json({ data: await service.upload(caller(req), readRawUpload(req)) });
    }),
  );

  router.delete(
    '/me/photo',
    authenticate,
    requirePermission('profile.update'),
    asyncHandler(async (req: Request, res: Response) => {
      await service.remove(caller(req));
      res.status(204).end();
    }),
  );

  router.get(
    '/:id/photo',
    authenticate,
    requirePermission('employees.read'),
    validate({ params: idParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: idParamSchema });
      const photo = await service.open(params.id, accessFor(req).filter, caller(req));
      if (req.header('if-none-match') === photo.etag) {
        res.status(304).end();
        return;
      }
      res.status(200);
      res.setHeader('Content-Type', photo.contentType);
      res.setHeader('Content-Length', String(photo.body.length));
      res.setHeader('ETag', photo.etag);
      // The URL carries ?v=<version>, so a replaced photo is a new URL: a day of caching is safe.
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Disposition', 'inline');
      res.end(photo.body);
    }),
  );

  return router;
}
