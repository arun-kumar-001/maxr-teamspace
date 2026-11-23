import { Request, Response } from 'express';
import { validated } from '../../../http/validate';
import { accessFor } from '../../rbac';
import { employeeDirectoryQuerySchema } from './directory.schemas';
import { EmployeeDirectoryService } from './directory.service';

export class EmployeeDirectoryController {
  constructor(private readonly service: EmployeeDirectoryService) {}

  list = async (req: Request, res: Response): Promise<void> => {
    const { query } = validated(req, { query: employeeDirectoryQuerySchema });
    const { filter } = accessFor(req);
    const result = await this.service.list(query, filter);
    res.status(200).json(result);
  };
}
