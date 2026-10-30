import { Request, Response } from 'express';
import { ROLES } from '@maxr/shared';
import { forbidden, unauthorized } from '../../http/errors';
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

  listShifts = async (req: Request, res: Response): Promise<void> => {
    this.getActor(req);
    const { query } = validated(req, { query: listShiftsQuerySchema });
    const page = await this.service.listShifts(query);
    res.status(200).json(page);
  };

  getShiftById = async (req: Request, res: Response): Promise<void> => {
    this.getActor(req);
    const shift = await this.service.getShiftById(req.params.id as string);
    res.status(200).json({ data: shift });
  };

  createShift = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createShiftSchema });
    const created = await this.service.createShift(body, this.context(req));
    res.status(201).json({ data: created });
  };

  updateShift = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: updateShiftSchema });
    const updated = await this.service.updateShift(
      req.params.id as string,
      body,
      this.context(req),
    );
    res.status(200).json({ data: updated });
  };

  assignShift = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: assignEmployeeShiftSchema });
    const assigned = await this.service.assignEmployeeShift(body, this.context(req));
    res.status(201).json({ data: assigned });
  };

  listEmployeeShifts = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const employeeId =
      (req.params.employeeId as string) || (req.query.employeeId as string) || actor.employeeId;
    const shifts = await this.service.getEmployeeShifts(employeeId);
    res.status(200).json({ data: shifts });
  };

  getPolicy = async (req: Request, res: Response): Promise<void> => {
    this.getActor(req);
    const policy = await this.service.getAttendancePolicy();
    res.status(200).json({ data: policy });
  };

  updatePolicy = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: updateAttendancePolicySchema });
    const updated = await this.service.updateAttendancePolicy(body, this.context(req));
    res.status(200).json({ data: updated });
  };
}
