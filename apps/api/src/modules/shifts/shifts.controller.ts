import { Request, Response } from 'express';
import { forbidden } from '../../http/errors';
import { validated } from '../../http/validate';
import {
  assignEmployeeShiftSchema,
  createShiftSchema,
  listShiftsQuerySchema,
  updateAttendancePolicySchema,
  updateShiftSchema,
} from './shifts.schemas';
import { RequestContext, ShiftsService } from './shifts.service';

export class ShiftsController {
  constructor(private readonly service: ShiftsService) {}

  private context(req: Request): RequestContext {
    return {
      actorId: req.actor?.id ?? 'system',
      requestId: req.id,
    };
  }

  private checkHrOrAdmin(req: Request): void {
    const actorRole = (req.actor as { id: string; role?: string } | undefined)?.role;
    const role = (req.headers['x-role'] as string) || actorRole;
    if (role && role !== 'HR Manager' && role !== 'Admin') {
      throw forbidden('Only HR Manager or Admin can perform this configuration');
    }
  }

  listShifts = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listShiftsQuerySchema });
    const page = await this.service.listShifts(query);
    res.status(200).json(page);
  };

  getShiftById = async (req: Request, res: Response): Promise<void> => {
    const shift = await this.service.getShiftById(req.params.id as string);
    res.status(200).json({ data: shift });
  };

  createShift = async (req: Request, res: Response): Promise<void> => {
    this.checkHrOrAdmin(req);
    const { body } = validated(req, { body: createShiftSchema });
    const created = await this.service.createShift(body, this.context(req));
    res.status(201).json({ data: created });
  };

  updateShift = async (req: Request, res: Response): Promise<void> => {
    this.checkHrOrAdmin(req);
    const { body } = validated(req, { body: updateShiftSchema });
    const updated = await this.service.updateShift(
      req.params.id as string,
      body,
      this.context(req),
    );
    res.status(200).json({ data: updated });
  };

  assignShift = async (req: Request, res: Response): Promise<void> => {
    this.checkHrOrAdmin(req);
    const { body } = validated(req, { body: assignEmployeeShiftSchema });
    const assignment = await this.service.assignEmployeeShift(body, this.context(req));
    res.status(201).json({ data: assignment });
  };

  getEmployeeShifts = async (req: Request, res: Response): Promise<void> => {
    const employeeId = req.params.employeeId || req.actor?.id;
    if (!employeeId) {
      res.status(200).json({ data: [] });
      return;
    }
    const assignments = await this.service.getEmployeeShifts(employeeId);
    res.status(200).json({ data: assignments });
  };

  getPolicy = async (_req: Request, res: Response): Promise<void> => {
    const policy = await this.service.getAttendancePolicy();
    res.status(200).json({ data: policy });
  };

  updatePolicy = async (req: Request, res: Response): Promise<void> => {
    this.checkHrOrAdmin(req);
    const { body } = validated(req, { body: updateAttendancePolicySchema });
    const updated = await this.service.updateAttendancePolicy(body, this.context(req));
    res.status(200).json({ data: updated });
  };
}
