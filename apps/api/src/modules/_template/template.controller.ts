import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { validated } from '../../http/validate';
import { accessFor } from '../rbac';
import { RequestContext, TemplateService } from './template.service';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from './template.schemas';

/** HTTP only: read validated input, call the service, shape the response. */
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  // `req.actor` comes from `authenticate`, `accessFor(req).filter` from `requirePermission`.
  private context(req: Request): RequestContext {
    const { actor } = req;
    if (!actor) {
      throw new Error('authenticate() did not run before this handler');
    }
    return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listTemplatesQuerySchema });
    res.status(200).json(await this.service.list(query, accessFor(req).filter));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    res.status(200).json({ data: await this.service.getById(params.id, accessFor(req).filter) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createTemplateSchema });
    res.status(201).json({ data: await this.service.create(body, this.context(req)) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, { params: idParamSchema, body: updateTemplateSchema });
    res.status(200).json({
      data: await this.service.update(params.id, body, this.context(req), accessFor(req).filter),
    });
  };

  deactivate = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    await this.service.deactivate(params.id, this.context(req), accessFor(req).filter);
    res.status(200).json({ data: { id: params.id, isActive: false } });
  };
}
