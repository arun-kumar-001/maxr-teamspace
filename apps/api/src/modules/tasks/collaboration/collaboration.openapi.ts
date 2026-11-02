import { z } from 'zod';
import { registerRoute } from '../../../openapi/registry';
import {
  addCommentSchema,
  attachmentParamsSchema,
  attachmentSchema,
  commentSchema,
  downloadLinkSchema,
  listCommentsQuerySchema,
  taskParamsSchema,
} from './collaboration.schemas';

const tags = ['Tasks'];
const notVisible = { 404: 'You cannot see this task (or it does not exist)' };

registerRoute({
  method: 'get',
  path: '/tasks/{id}/comments',
  tags,
  summary: 'The comment thread of a task you can see, oldest first',
  permission: 'tasks.read_own',
  params: taskParamsSchema,
  query: listCommentsQuerySchema,
  extraResponses: notVisible,
  success: {
    status: 200,
    description: 'A page of comments',
    schema: z.object({
      data: z.array(commentSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/tasks/{id}/comments',
  tags,
  summary:
    'Comment on a task you can see. Comments cannot be edited or deleted. The assignee and the assigner are told (without the text)',
  permission: 'tasks.collaborate',
  params: taskParamsSchema,
  body: addCommentSchema,
  extraResponses: notVisible,
  success: { status: 201, description: 'The comment', schema: z.object({ data: commentSchema }) },
});

registerRoute({
  method: 'get',
  path: '/tasks/{id}/attachments',
  tags,
  summary: 'The files attached to a task you can see',
  permission: 'tasks.read_own',
  params: taskParamsSchema,
  extraResponses: notVisible,
  success: {
    status: 200,
    description: 'The attachments, oldest first',
    schema: z.object({ data: z.array(attachmentSchema) }),
  },
});

registerRoute({
  method: 'post',
  path: '/tasks/{id}/attachments',
  tags,
  summary:
    'Attach a file to a task you can see: the file is the raw request body. PDF, PNG or JPEG up to 10 MB, checked by content and scanned. The same file is attached once (409); a task holds at most 20 files',
  permission: 'tasks.collaborate',
  params: taskParamsSchema,
  upload: { contentTypes: ['application/pdf', 'image/png', 'image/jpeg'] },
  extraResponses: {
    ...notVisible,
    409: 'This file is already attached',
    400: 'Not an allowed type, the file name or type does not match the content, or the body is empty',
    413: 'The file is larger than 10 MB',
    422: 'Rejected by the virus scan, or the task already holds 20 files',
  },
  success: {
    status: 201,
    description: 'The attachment',
    schema: z.object({ data: attachmentSchema }),
  },
});

registerRoute({
  method: 'get',
  path: '/tasks/{id}/attachments/{attachmentId}/download-link',
  tags,
  summary:
    'A short-lived download link for one file, bound to your session. Follow `url` (GET /files/download) to download it',
  permission: 'tasks.read_own',
  params: attachmentParamsSchema,
  extraResponses: notVisible,
  success: { status: 200, description: 'The link', schema: z.object({ data: downloadLinkSchema }) },
});

registerRoute({
  method: 'delete',
  path: '/tasks/{id}/attachments/{attachmentId}',
  tags,
  summary:
    'Remove a file (the person who attached it, the person who assigned the task, or an Admin)',
  permission: 'tasks.collaborate',
  params: attachmentParamsSchema,
  extraResponses: { ...notVisible, 403: 'You may not remove this file' },
  success: {
    status: 200,
    description: 'Removed',
    schema: z.object({ data: z.object({ removed: z.boolean() }) }),
  },
});
