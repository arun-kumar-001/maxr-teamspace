import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { validated } from '../../../http/validate';
import { DesignationService, RequestContext } from './designation.service';
import {
  createDesignationSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from './designation.schemas';

export class DesignationController {
  constructor(private readonly service: DesignationService) {}

  private context(req: Request): RequestContext {
    const { actor } = req;
    if (!actor) {
      throw new Error('authenticate() did not run before this handler');
    }
    return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listDesignationsQuerySchema });
    res.status(200).json(await this.service.list(query));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    res.status(200).json({ data: await this.service.getById(params.id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createDesignationSchema });
    res.status(201).json({ data: await this.service.create(body, this.context(req)) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: updateDesignationSchema,
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
