import { Request, Response } from 'express';
import { forbidden } from '../../http/errors';
import { validated } from '../../http/validate';
import { checkInSchema, checkOutSchema, listAttendanceQuerySchema } from './attendance.schemas';
import { AttendanceService, RequestContext } from './attendance.service';

export class AttendanceController {
  constructor(private readonly service: AttendanceService) {}

  private context(req: Request): RequestContext {
    return {
      actorId: req.actor?.id ?? 'system',
      requestId: req.id,
    };
  }

  private getEmployeeId(req: Request): string {
    const headerEmployeeId = req.headers['x-employee-id'];
    if (typeof headerEmployeeId === 'string' && headerEmployeeId.trim().length > 0) {
      return headerEmployeeId.trim();
    }
    return req.actor?.id ?? '00000000-0000-0000-0000-000000000001';
  }

  getActive = async (req: Request, res: Response): Promise<void> => {
    const employeeId = this.getEmployeeId(req);
    const active = await this.service.getActiveSession(employeeId);
    res.status(200).json({ data: active });
  };

  getToday = async (req: Request, res: Response): Promise<void> => {
    const employeeId = this.getEmployeeId(req);
    const summary = await this.service.getTodaySummary(employeeId);
    res.status(200).json({ data: summary });
  };

  checkIn = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: checkInSchema });
    const employeeId = this.getEmployeeId(req);
    const session = await this.service.checkIn(employeeId, body, this.context(req));
    res.status(201).json({ data: session });
  };

  checkOut = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: checkOutSchema });
    const employeeId = this.getEmployeeId(req);
    const session = await this.service.checkOut(employeeId, body, this.context(req));
    res.status(200).json({ data: session });
  };

  getMyHistory = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const employeeId = this.getEmployeeId(req);
    const page = await this.service.listHistory(employeeId, query);
    res.status(200).json(page);
  };

  listHistory = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const employeeId = this.getEmployeeId(req);
    const page = await this.service.listHistory(employeeId, query);
    res.status(200).json(page);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listAttendanceQuerySchema });
    const actorRole = (req.actor as { id: string; role?: string } | undefined)?.role;
    const role = (req.headers['x-role'] as string) || actorRole || 'Staff';
    const employeeId = this.getEmployeeId(req);

    if (role === 'Staff' || role === 'Employee') {
      if (query.employeeId && query.employeeId !== employeeId) {
        throw forbidden('Staff members can only view their own attendance records');
      }
      const page = await this.service.listHistory(employeeId, query);
      res.status(200).json(page);
      return;
    }

    let scope: { employeeIds?: string[] } | undefined;
    if (role === 'Team Lead') {
      const teamHeader = req.headers['x-team-employees'];
      if (typeof teamHeader === 'string') {
        scope = { employeeIds: teamHeader.split(',').map((id) => id.trim()) };
      }
    }

    const page = await this.service.listAll(query, scope);
    res.status(200).json(page);
  };
}
