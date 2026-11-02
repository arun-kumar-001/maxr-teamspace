import { Request, RequestHandler, Response, Router } from 'express';
import { asyncHandler } from '../../http/async-handler';
import { validate, validated } from '../../http/validate';
import { requirePermission } from '../rbac';
import {
  listMeetingsQuerySchema,
  meetingIdParamsSchema,
  rsvpSchema,
  scheduleMeetingSchema,
  updateMeetingSchema,
} from './meetings.schemas';
import { MeetingCaller, MeetingsService } from './meetings.service';

function caller(req: Request): MeetingCaller {
  const { actor } = req;
  if (!actor) throw new Error('authenticate() did not run before this handler');
  return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
}

/**
 * Mounted at /api/v1/meetings. Who may schedule is the permission (Team Lead, HR Manager, Admin);
 * who may read, answer, or change a meeting is decided by the service from the organizer and the
 * invitee list. Everything the caller can see is in SQL.
 */
export function createMeetingsRouter(options: {
  service: MeetingsService;
  authenticate: RequestHandler;
}): Router {
  const { service } = options;
  const router = Router();
  router.use(options.authenticate);

  router.get(
    '/',
    requirePermission('meetings.read_own'),
    validate({ query: listMeetingsQuerySchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { query } = validated(req, { query: listMeetingsQuerySchema });
      res.status(200).json(await service.list(query, caller(req).employeeId));
    }),
  );

  router.post(
    '/',
    requirePermission('meetings.schedule'),
    validate({ body: scheduleMeetingSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { body } = validated(req, { body: scheduleMeetingSchema });
      res.status(201).json({ data: await service.schedule(body, caller(req)) });
    }),
  );

  router.get(
    '/:id',
    requirePermission('meetings.read_own'),
    validate({ params: meetingIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: meetingIdParamsSchema });
      res.status(200).json({ data: await service.get(params.id, caller(req).employeeId) });
    }),
  );

  router.put(
    '/:id',
    requirePermission('meetings.schedule'),
    validate({ params: meetingIdParamsSchema, body: updateMeetingSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, {
        params: meetingIdParamsSchema,
        body: updateMeetingSchema,
      });
      res.status(200).json({ data: await service.update(params.id, body, caller(req)) });
    }),
  );

  router.post(
    '/:id/cancel',
    requirePermission('meetings.schedule'),
    validate({ params: meetingIdParamsSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params } = validated(req, { params: meetingIdParamsSchema });
      res.status(200).json({ data: await service.cancel(params.id, caller(req)) });
    }),
  );

  router.post(
    '/:id/rsvp',
    requirePermission('meetings.rsvp'),
    validate({ params: meetingIdParamsSchema, body: rsvpSchema }),
    asyncHandler(async (req: Request, res: Response) => {
      const { params, body } = validated(req, { params: meetingIdParamsSchema, body: rsvpSchema });
      res.status(200).json({ data: await service.rsvp(params.id, body.response, caller(req)) });
    }),
  );

  return router;
}
