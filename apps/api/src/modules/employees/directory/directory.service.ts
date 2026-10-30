import { PaginatedResponse } from '@maxr/shared';
import { buildPage, resolveSort, toOffsetLimit } from '../../../http/pagination';
import { ScopeFilter } from '../../rbac/scope';
import { IEmployeeDirectoryRepository } from './directory.repository';
import { EMPLOYEE_SORTABLE_FIELDS } from './directory.schemas';
import { EmployeeDirectoryItem, EmployeeDirectoryQuery } from './directory.types';

export class EmployeeDirectoryService {
  constructor(private readonly repository: IEmployeeDirectoryRepository) {}

  async list(
    query: EmployeeDirectoryQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<EmployeeDirectoryItem>> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pageSize = Number(query.pageSize) > 0 ? Math.min(Number(query.pageSize), 100) : 20;
    const sort = resolveSort(
      { sortBy: query.sortBy, sortOrder: query.sortOrder ?? 'asc' },
      EMPLOYEE_SORTABLE_FIELDS,
      { column: 'name', order: 'asc' },
    );

    const { items, total } = await this.repository.findMany({
      ...toOffsetLimit({ page, pageSize }),
      sort,
      filter,
      search: query.search,
      departmentId: query.departmentId,
      designationId: query.designationId,
      status: query.status,
      managerId: query.managerId,
    });

    return buildPage(items, total, { page, pageSize });
  }
}
