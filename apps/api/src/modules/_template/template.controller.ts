import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { validated } from '../../http/validate';
import { TemplateService } from './template.service';
import {
  createTemplateSchema,
  listTemplatesQuerySchema,
  updateTemplateSchema,
} from './template.schemas';

/** HTTP only: read validated input, call the service, shape the response. */
export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  // `actor` is set by the auth middleware (issue #7); `visibleOwnerIds` by the RBAC scope
  // resolver (issue #8). Until they exist the sample runs unrestricted as "system".
  private actorId(req: Request): string {
    return req.actor?.id ?? 'system';
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listTemplatesQuerySchema });
    res.status(200).json(await this.service.list(query));
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    res.status(200).json({ data: await this.service.getById(params.id) });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createTemplateSchema });
    res.status(201).json({ data: await this.service.create(body, this.actorId(req)) });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, { params: idParamSchema, body: updateTemplateSchema });
    res.status(200).json({ data: await this.service.update(params.id, body) });
  };

  deactivate = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    await this.service.deactivate(params.id);
    res.status(200).json({ data: { id: params.id, isActive: false } });
  };
}
