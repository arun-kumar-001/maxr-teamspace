import { Request, Response, NextFunction } from 'express';
import { TemplateService } from './template.service';
import { TemplateFilterQuery, CreateTemplateDto, UpdateTemplateDto } from './template.types';

export class TemplateController {
  constructor(private readonly service: TemplateService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query: TemplateFilterQuery = {
        page: req.query.page ? parseInt(req.query.page as string, 10) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20,
        search: req.query.search as string,
        isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      };

      // In real modules, scopeFilter is populated by the RBAC middleware (TL-06)
      const result = await this.service.list(query);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const result = await this.service.getById(id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const body = req.body as CreateTemplateDto;
      const actorUserId = 'system'; // Replaced by req.user.id in real modules
      const result = await this.service.create(body, actorUserId);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      const body = req.body as UpdateTemplateDto;
      const result = await this.service.update(id, body);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  deactivate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id as string;
      await this.service.deactivate(id);
      res.status(200).json({ data: { message: `Template '${id}' successfully deactivated` } });
    } catch (err) {
      next(err);
    }
  };
}
