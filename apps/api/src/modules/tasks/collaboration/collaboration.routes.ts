import { RECORD_SCOPES } from '@maxr/shared';
import { Request, Response, Router } from 'express';
import { asyncHandler } from '../../../http/async-handler';
import { rawUploadParser, readRawUpload } from '../../../http/raw-upload';
import { validate, validated } from '../../../http/validate';
import { requirePermission, resolveScope } from '../../rbac';
import type { TaskViewer } from '../tasks.types';
import {
  addCommentSchema,
  attachmentParamsSchema,
  listCommentsQuerySchema,
  taskParamsSchema,
} from './collaboration.schemas';
import { CollabCaller, TaskCollaborationService } from './collaboration.service';

/** Files up to this size are read; the storage service applies the stricter per-category limit. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function caller(req: Request): CollabCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

function viewer(req: Request): TaskViewer {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return {
    employeeId: actor.employeeId,
    all: resolveScope(actor.roles, 'tasks.read_team') === RECORD_SCOPES.ALL,
  };
}

/**
 * Mounted inside the tasks router, which has already authenticated the caller: `/:id/comments`
 * and `/:id/attachments...`.
 * Every route first asks for the task as the caller, so a task you cannot see is a 404 here too.
 * The file is the raw request body (see http/raw-upload.ts).
 */
export function createCollaborationRouter(options: { service: TaskCollaborationService }): Router {
  const { service } = options;
  const router = Router();

  router.get(
    '/:id/comments',
    requirePermission('tasks.read_own'),
    validate({ params: taskParamsSchema, query: listCommentsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, query } = validated(req, {
        params: taskParamsSchema,
        query: listCommentsQuerySchema,
      });
      res.status(200).json(await service.listComments(params.id, query, viewer(req)));
    }),
  );

  router.post(
    '/:id/comments',
    requirePermission('tasks.collaborate'),
    validate({ params: taskParamsSchema, body: addCommentSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, { params: taskParamsSchema, body: addCommentSchema });
      res
        .status(201)
        .json({ data: await service.addComment(params.id, body, caller(req), viewer(req)) });
    }),
  );

  router.get(
    '/:id/attachments',
    requirePermission('tasks.read_own'),
    validate({ params: taskParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: taskParamsSchema });
      res.status(200).json({ data: await service.listAttachments(params.id, viewer(req)) });
    }),
  );

  router.post(
    '/:id/attachments',
    requirePermission('tasks.collaborate'),
    validate({ params: taskParamsSchema }),
    rawUploadParser(MAX_UPLOAD_BYTES),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: taskParamsSchema });
      const file = readRawUpload(req);
      res.status(201).json({
        data: await service.addAttachment(params.id, file, caller(req), viewer(req)),
      });
    }),
  );

  router.get(
    '/:id/attachments/:attachmentId/download-link',
    requirePermission('tasks.read_own'),
    validate({ params: attachmentParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: attachmentParamsSchema });
      res.status(200).json({
        data: await service.downloadLink(params.id, params.attachmentId, caller(req), viewer(req)),
      });
    }),
  );

  router.delete(
    '/:id/attachments/:attachmentId',
    requirePermission('tasks.collaborate'),
    validate({ params: attachmentParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: attachmentParamsSchema });
      await service.removeAttachment(params.id, params.attachmentId, caller(req), viewer(req));
      res.status(200).json({ data: { removed: true } });
    }),
  );

  return router;
}
