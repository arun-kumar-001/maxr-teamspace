import { Request, Response } from 'express';
import { idParamSchema } from '@maxr/shared';
import { unauthorized } from '../../http/errors';
import { validated } from '../../http/validate';
import {
  createApprovalSchema,
  decisionSchema,
  listApprovalsQuerySchema,
} from './approvals.schemas';
import { ApprovalsService, RequestContext } from './approvals.service';

export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

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

  list = async (req: Request, res: Response): Promise<void> => {
    this.getActor(req);
    const { query } = validated(req, { query: listApprovalsQuerySchema });
    const page = await this.service.listInbox(query);
    res.status(200).json(page);
  };

  getById = async (req: Request, res: Response): Promise<void> => {
    this.getActor(req);
    const { params } = validated(req, { params: idParamSchema });
    const item = await this.service.getById(params.id);
    res.status(200).json({ data: item });
  };

  create = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const { body } = validated(req, { body: createApprovalSchema });
    // Requester is ALWAYS the authenticated actor's employeeId (never client-supplied)
    const created = await this.service.create(
      { ...body, requesterId: actor.employeeId },
      this.context(req),
    );
    res.status(201).json({ data: created });
  };

  approve = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: decisionSchema,
    });
    const decided = await this.service.approve(
      params.id,
      actor.employeeId,
      body,
      this.context(req),
    );
    res.status(200).json({ data: decided });
  };

  reject = async (req: Request, res: Response): Promise<void> => {
    const actor = this.getActor(req);
    const { params, body } = validated(req, {
      params: idParamSchema,
      body: decisionSchema,
    });
    const decided = await this.service.reject(params.id, actor.employeeId, body, this.context(req));
    res.status(200).json({ data: decided });
  };
}
