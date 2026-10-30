import { NextFunction, Request, Response } from 'express';
import { accessFor } from '../../rbac';
import { EmployeeDirectoryService } from './directory.service';
import { EmployeeDirectoryQuery } from './directory.types';

export class EmployeeDirectoryController {
  constructor(private readonly service: EmployeeDirectoryService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { filter } = accessFor(req);
      const query = (req.validated?.query ?? req.query) as unknown as EmployeeDirectoryQuery;
      const result = await this.service.list(query, filter);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  };
}
