import { MAX_PAGE_SIZE } from '@maxr/shared';
import { z } from 'zod';

const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

export const notificationIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const listNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
    unread: booleanQuery.optional(),
  })
  .strict();

export const announceSchema = z
  .object({
    title: z.string().trim().min(1).max(100),
    message: z.string().trim().min(1).max(1000),
  })
  .strict();

export const notificationSchema = z
  .object({
    id: z.string().uuid(),
    type: z.string(),
    title: z.string(),
    body: z.string(),
    link: z.string().nullable(),
    readAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
  })
  .meta({ id: 'Notification' });

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type AnnounceInput = z.infer<typeof announceSchema>;
