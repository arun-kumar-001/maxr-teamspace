import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { validated } from '../../../http/validate';
import { DepartmentService, RequestContext } from './department.service';
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from './department.schemas';

export class DepartmentController {
  constructor(private readonly service: DepartmentService) {}

  private context(req: Request): RequestContext {
    const { actor } = req;
    if (!actor) {
      throw new Error('authenticate() did not run before this handler');
    }
    return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listDepartmentsQuerySchema });
    res.status(200).json(await this.service.list(query));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    res.status(200).json({ data: await this.service.getById(params.id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createDepartmentSchema });
    res.status(201).json({ data: await this.service.create(body, this.context(req)) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: updateDepartmentSchema,
    });
    res.status(200).json({
      data: await this.service.update(params.id, body, this.context(req)),
    });
  };

  deactivate = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    await this.service.deactivate(params.id, this.context(req));
    res.status(200).json({ data: { id: params.id, isActive: false } });
  };
}
