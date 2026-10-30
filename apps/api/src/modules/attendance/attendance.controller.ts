import { Request, Response } from 'express';
import { unauthorized } from '../../http/errors';
import { validated } from '../../http/validate';
import { accessFor } from '../rbac';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from './attendance.schemas';
import { AttendanceService, RequestContext } from './attendance.service';

export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  private getActor(req: Request) {
    if (!req.actor) {
      throw unauthorized();
    }
    return req.actor;
  }

  private context(req: Request): RequestContext {
    const actor = this.getActor(req);
    return {
      actorId: actor.id,
      actorRole: actor.role,
      employeeId: actor.employeeId,
      requestId: req.id,
    };
  }

  getActive = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const active = await this.service.getActiveSession(actor.employeeId);
    res.status(200).json({ data: active });
  };

  getToday = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const summary = await this.service.getTodaySummary(actor.employeeId);
    res.status(200).json({ data: summary });
  };

  checkIn = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: checkInSchema });
    const actor = this.getActor(req);
    const session = await this.service.checkIn(actor.employeeId, body, this.context(req));
    res.status(201).json({ data: session });
  };

  checkOut = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: checkOutSchema });
    const actor = this.getActor(req);
    const session = await this.service.checkOut(actor.employeeId, body, this.context(req));
    res.status(200).json({ data: session });
  };

  getMyHistory = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const actor = this.getActor(req);
    const page = await this.service.listHistory(actor.employeeId, query, accessFor(req).filter);
    res.status(200).json(page);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const page = await this.service.list(query, accessFor(req).filter);
    res.status(200).json(page);
  };
}
