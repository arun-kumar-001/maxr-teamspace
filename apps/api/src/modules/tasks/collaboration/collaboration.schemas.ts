import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

export const taskParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const attachmentParamsSchema = z
  .object({ id: z.string().uuid(), attachmentId: z.string().uuid() })
  .strict();

export const addCommentSchema = z.object({ body: z.string().trim().min(1).max(2000) }).strict();

export const listCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
  })
  .strict();

export const commentSchema = z
  .object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    authorEmployeeId: z.string().uuid(),
    authorName: z.string(),
    body: z.string(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'TaskComment' });

export const attachmentSchema = z
  .object({
    id: z.string().uuid(),
    taskId: z.string().uuid(),
    uploadedByEmployeeId: z.string().uuid(),
    uploadedByName: z.string(),
    originalName: z.string(),
    contentType: z.string(),
    size: z.number().int(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'TaskAttachment' });

export const downloadLinkSchema = z
  .object({ url: z.string(), expiresAt: z.string().datetime() })
  .meta({ id: 'DownloadLink' });

export type AddCommentInput = z.infer<typeof addCommentSchema>;
export type ListCommentsQuery = z.infer<typeof listCommentsQuerySchema>;
