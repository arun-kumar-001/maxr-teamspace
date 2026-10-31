import { z } from 'zod';
import { registerRoute } from '../../openapi/registry';
import {
  announceSchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  notificationSchema,
} from './notifications.schemas';

const tags = ['Notifications'];

registerRoute({
  method: 'get',
  path: '/notifications',
  tags,
  summary: 'Your own notifications, newest first. `meta.unread` is the badge count',
  permission: 'notifications.read_own',
  query: listNotificationsQuerySchema,
  success: {
    status: 200,
    description: 'A page of your notifications',
    schema: z.object({
      data: z.array(notificationSchema),
      meta: z.object({
        page: z.number().int(),
        pageSize: z.number().int(),
        total: z.number().int(),
        totalPages: z.number().int(),
        unread: z.number().int(),
      }),
    }),
  },
});

registerRoute({
  method: 'post',
  path: '/notifications/read-all',
  tags,
  summary: 'Mark all of your notifications read',
  permission: 'notifications.read_own',
  success: {
    status: 200,
    description: 'How many were unread',
    schema: z.object({ data: z.object({ updated: z.number().int() }) }),
  },
});

registerRoute({
  method: 'post',
  path: '/notifications/{id}/read',
  tags,
  summary: 'Mark one of your notifications read (repeating it is harmless). 404 for anyone else’s',
  permission: 'notifications.read_own',
  params: notificationIdParamsSchema,
  success: {
    status: 200,
    description: 'The notification',
    schema: z.object({ data: notificationSchema }),
  },
});

registerRoute({
  method: 'post',
  path: '/notifications/announcements',
  tags,
  summary:
    'Send an in-app announcement to every active employee (Admin). Announcements are not e-mailed',
  permission: 'notifications.announce',
  idempotent: true,
  body: announceSchema,
  success: {
    status: 201,
    description: 'How many employees received it',
    schema: z.object({ data: z.object({ recipients: z.number().int() }) }),
  },
});
