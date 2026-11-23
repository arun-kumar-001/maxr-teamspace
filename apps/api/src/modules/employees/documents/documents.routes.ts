import { idParamSchema } from '@maxr/shared';
import { Request, RequestHandler, Response, Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../../http/async-handler';
import { validationError } from '../../../http/errors';
import { rawUploadParser, readRawUpload } from '../../../http/raw-upload';
import { validate, validated } from '../../../http/validate';
import { requirePermission } from '../../rbac';
import {
  documentIdParamSchema,
  documentTypeSchema,
  listDocumentsQuerySchema,
} from './documents.schemas';
import { EmployeeDocumentsService } from './documents.service';
import type { DocumentType } from './documents.types';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export function createEmployeeDocumentsRouter(options: {
  service: EmployeeDocumentsService;
  authenticate: RequestHandler;
}): Router {
  const router = Router();

  // GET /employees/:id/documents - List documents
  router.get(
    '/:id/documents',
    options.authenticate,
    requirePermission('documents.read'),
    validate({ params: idParamSchema, query: listDocumentsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');

      const { params, query } = validated(req, {
        params: idParamSchema,
        query: listDocumentsQuerySchema,
      });

      const docs = await options.service.listDocuments(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        query,
      );

      res.status(200).json({ data: docs });
    }),
  );

  // POST /employees/:id/documents - Raw upload
  router.post(
    '/:id/documents',
    options.authenticate,
    requirePermission('documents.upload'),
    validate({ params: idParamSchema }),
    rawUploadParser(MAX_UPLOAD_BYTES),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');

      const { params } = validated(req, { params: idParamSchema });
      const raw = readRawUpload(req);

      // Extract document metadata from query or headers
      const rawType = (req.query.documentType as string) || req.header('x-document-type');
      const rawTitle =
        (req.query.title as string) ||
        (req.header('x-document-title')
          ? decodeURIComponent(req.header('x-document-title')!)
          : null) ||
        raw.filename;
      const rawSensitive =
        req.query.isSensitive === 'true' || req.header('x-is-sensitive') === 'true';

      const typeParsed = documentTypeSchema.safeParse(rawType);
      if (!typeParsed.success) {
        throw validationError([
          {
            field: 'documentType',
            message: 'A valid documentType is required (via query or X-Document-Type header)',
            rule: 'invalid_enum',
          },
        ]);
      }

      const titleParsed = z.string().trim().min(1).max(200).safeParse(rawTitle);
      if (!titleParsed.success) {
        throw validationError([
          {
            field: 'title',
            message: 'Document title must be between 1 and 200 characters',
            rule: 'length',
          },
        ]);
      }

      const uploaded = await options.service.uploadDocument(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        {
          employeeId: params.id,
          uploadedByEmployeeId: actor.employeeId ?? actor.id,
          documentType: typeParsed.data as DocumentType,
          title: titleParsed.data,
          isSensitive: rawSensitive,
          filename: raw.filename,
          declaredType: raw.declaredType,
          body: raw.body,
        },
      );

      res.status(201).json({ data: uploaded });
    }),
  );

  // GET /employees/:id/documents/:docId/download-link - Ephemeral signed link
  router.get(
    '/:id/documents/:docId/download-link',
    options.authenticate,
    requirePermission('documents.download'),
    validate({ params: documentIdParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');

      const { params } = validated(req, { params: documentIdParamSchema });

      const link = await options.service.createDownloadLink(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        params.docId,
      );

      res.status(200).json({ data: link });
    }),
  );

  // DELETE /employees/:id/documents/:docId - Soft delete
  router.delete(
    '/:id/documents/:docId',
    options.authenticate,
    requirePermission('documents.delete'),
    validate({ params: documentIdParamSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { actor } = req;
      if (!actor) throw new Error('authenticate() did not run');

      const { params } = validated(req, { params: documentIdParamSchema });

      await options.service.deleteDocument(
        {
          actorId: actor.id,
          employeeId: actor.employeeId,
          roles: actor.roles,
          requestId: req.id,
        },
        params.id,
        params.docId,
      );

      res.status(204).end();
    }),
  );

  return router;
}
