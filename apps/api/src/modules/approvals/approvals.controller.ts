import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { validated } from '../../http/validate';
import {
  createApprovalSchema,
  decisionSchema,
  listApprovalsQuerySchema,
} from './approvals.schemas';
import { ApprovalsService, RequestContext } from './approvals.service';

export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  private context(req: Request): RequestContext {
    return {
      actorId: req.actor?.id ?? 'system',
      requestId: req.id,
    };
  }

  private getApproverId(req: Request): string {
    const headerApproverId = req.headers['x-approver-id'];
    if (typeof headerApproverId === 'string' && headerApproverId.trim().length > 0) {
      return headerApproverId.trim();
    }
    return req.actor?.id ?? '00000000-0000-0000-0000-000000000099';
  }

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: listApprovalsQuerySchema });
    const page = await this.service.listInbox(query);
    res.status(200).json(page);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    const { params } = validated(req, { params: idParamSchema });
    const item = await this.service.getById(params.id);
    res.status(200).json({ data: item });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: createApprovalSchema });
    const created = await this.service.create(body, this.context(req));
    res.status(201).json({ data: created });
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: decisionSchema,
    });
    const approverId = this.getApproverId(req);
    const decided = await this.service.approve(params.id, approverId, body, this.context(req));
    res.status(200).json({ data: decided });
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: decisionSchema,
    });
    const approverId = this.getApproverId(req);
    const decided = await this.service.reject(params.id, approverId, body, this.context(req));
    res.status(200).json({ data: decided });
  };
}
