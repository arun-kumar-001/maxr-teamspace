import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../../http/app-error';
import { asyncHandler } from '../../http/async-handler';
import { notFound } from '../../http/errors';
import { validate, validated } from '../../http/validate';
import { publicRoute } from '../../modules/rbac';
import { contentDisposition } from './filename';
import { StorageService } from './storage-service';

const querySchema = z.object({ token: z.string().min(1).max(2048) }).strict();

/**
 * GET /api/v1/files/download?token=...
 * The token is the permission: it was issued by a module after its own authorization check and
 * is bound to the user it was issued to. Every failure that does not prove a genuine token is a
 * plain 404, so nobody can probe which files exist.
 */
export function createFilesRouter(storage: StorageService): Router {
  const router = Router();

  router.get(
    '/download',
    publicRoute(),
    validate({ query: querySchema }),
    asyncHandler(async (req, res) => {
      const { query } = validated(req, { query: querySchema });
      const outcome = await storage.openDownload(query.token, { subject: req.actor?.id });

      if (!outcome.ok) {
        if (outcome.reason === 'expired') {
          throw new AppError(410, 'LINK_EXPIRED', 'This download link has expired');
        }
        throw notFound('File not found');
      }

      const { body, meta } = outcome.file;
      res.status(200);
      res.setHeader('Content-Type', meta.contentType);
      res.setHeader('Content-Length', String(body.length));
      // Uploaded files are never rendered by the browser, always downloaded.
      res.setHeader('Content-Disposition', contentDisposition(meta.originalName));
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, no-store');
      res.end(body);
    }),
  );

  return router;
}
