import { Request, Response } from 'express';
import { validated } from '../../http/validate';
import { RequestContext } from '../employees/types';
import { updateSettingsSchema } from './settings.schemas';
import { SettingsService } from './settings.service';

/** HTTP only. Permissions are checked by the routes. */
export class SettingsController {
  constructor(private readonly service: SettingsService) {}

  private context(req: Request): RequestContext {
    const { actor } = req;
    if (!actor) {
      throw new Error('authenticate() did not run before this handler');
    }
    return { actorId: actor.id, employeeId: actor.employeeId, requestId: req.id };
  }

  get = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.service.get() });
  };

  getBasic = async (_req: Request, res: Response): Promise<void> => {
    res.status(200).json({ data: await this.service.getBasic() });
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const { body } = validated(req, { body: updateSettingsSchema });
    res.status(200).json({ data: await this.service.update(body, this.context(req)) });
  };
}
