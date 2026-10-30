import { Request, Response } from 'express';
import { ROLES } from '@maxr/shared';
import { forbidden, unauthorized } from '../../http/errors';
import { validated } from '../../http/validate';
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
    const page = await this.service.listHistory(actor.employeeId, query);
    res.status(200).json(page);
  };

  listHistory = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const actor = this.getActor(req);

    // If query specifies another employee's records, enforce scope check
    const targetEmployeeId = query.employeeId ?? actor.employeeId;
    if (targetEmployeeId !== actor.employeeId) {
      if (actor.role === ROLES.STAFF) {
        throw forbidden('Staff members can only view their own attendance records');
      }
      if (actor.role === ROLES.TEAM_LEAD) {
        const teamMemberIds = await this.service.getTeamMemberIds(actor.employeeId);
        if (!teamMemberIds.includes(targetEmployeeId)) {
          throw forbidden('Team leads can only view attendance for their own team members');
        }
      } else if (actor.role !== ROLES.HR_MANAGER && actor.role !== ROLES.ADMIN) {
        throw forbidden();
      }
    }

    const page = await this.service.listHistory(targetEmployeeId, query);
    res.status(200).json(page);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const actor = this.getActor(req);

    if (actor.role === ROLES.STAFF) {
      if (query.employeeId && query.employeeId !== actor.employeeId) {
        throw forbidden('Staff members can only view their own attendance records');
      }
      const page = await this.service.listHistory(actor.employeeId, query);
      res.status(200).json(page);
      return;
    }

    let scope: { employeeIds?: string[] } | undefined;
    if (actor.role === ROLES.TEAM_LEAD) {
      const teamMemberIds = await this.service.getTeamMemberIds(actor.employeeId);
      if (query.employeeId && !teamMemberIds.includes(query.employeeId)) {
        throw forbidden('Team leads can only view attendance for their own team members');
      }
      scope = { employeeIds: query.employeeId ? [query.employeeId] : teamMemberIds };
    } else if (actor.role === ROLES.HR_MANAGER || actor.role === ROLES.ADMIN) {
      scope = query.employeeId ? { employeeIds: [query.employeeId] } : undefined;
    } else {
      // Deny by default on unknown role (AGENTS.md §1 & §7)
      throw forbidden();
    }

    const page = await this.service.listAll(query, scope);
    res.status(200).json(page);
  };
}
