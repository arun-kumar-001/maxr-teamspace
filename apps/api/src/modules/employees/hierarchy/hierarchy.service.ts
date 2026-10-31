import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../../http/errors';
import { buildPage, toOffsetLimit } from '../../../http/pagination';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import { ScopeFilter, scopeAllows } from '../../rbac';
import { IHierarchyRepository } from './hierarchy.repository';
import { EmployeeStatus, ManagerChange, OrgNode } from './hierarchy.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** Who is calling, taken from the session by the route, never from the body. */
export interface HierarchyCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

export interface OrgQuery {
  page: number;
  pageSize: number;
  status?: EmployeeStatus;
}

export class HierarchyService {
  constructor(
    private readonly repository: IHierarchyRepository,
    private readonly platform: Deps,
  ) {}

  /** The people at the top of the chart: no manager, and not deactivated unless asked for. */
  async roots(query: OrgQuery, filter: ScopeFilter): Promise<PaginatedResponse<OrgNode>> {
    return this.page(null, query, filter);
  }

  /**
   * The direct reports of one employee, so the chart can open one level at a time. The employee
   * must be inside the caller's scope or be the caller (a Team Lead's own team); the rows are
   * scoped as well. Unknown and out-of-scope look the same.
   */
  async directReports(
    employeeId: string,
    query: OrgQuery,
    filter: ScopeFilter,
    caller: HierarchyCaller,
  ): Promise<PaginatedResponse<OrgNode>> {
    if (!(await this.repository.isVisible(employeeId, filter, caller.employeeId))) {
      throw notFound('Employee not found');
    }
    return this.page(employeeId, query, filter);
  }

  private async page(managerId: string | null, query: OrgQuery, filter: ScopeFilter) {
    const { page, pageSize, status } = query;
    const { items, total } = await this.repository.listNodes(
      { managerId, status, ...toOffsetLimit({ page, pageSize }) },
      filter,
    );
    return buildPage(items, total, { page, pageSize });
  }

  /**
   * Gives an employee a manager, a different one, or none. Under one lock for the whole reporting
   * tree, in one transaction: the manager must be an active employee, and must not be the employee
   * or anyone who reports to them (that would make a loop). Team scope follows `manager_id`, so
   * the move takes effect for every scope check at once; nothing is cached.
   */
  async changeManager(
    employeeId: string,
    dto: { version: number; managerId: string | null },
    caller: HierarchyCaller,
    filter: ScopeFilter,
  ): Promise<ManagerChange> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    try {
      const change = await this.repository.transaction(async (tx) => {
        await this.repository.lockHierarchy(tx);
        const current = await this.repository.lockEmployee(tx, employeeId);
        // Out of scope looks exactly like missing.
        if (!current || !scopeAllows(filter, current.id, current.managerId)) {
          throw notFound('Employee not found');
        }
        if (current.status === 'deactivated') {
          throw unprocessable('A deactivated employee cannot be given a manager');
        }
        if (current.version !== dto.version) {
          throw conflict('This employee was changed by someone else. Reload and try again');
        }
        if (current.managerId === dto.managerId) {
          return this.repository.loadChange(tx, employeeId);
        }

        if (dto.managerId !== null) {
          if (dto.managerId === employeeId) {
            throw unprocessable('An employee cannot be their own manager');
          }
          const manager = await this.repository.findManager(tx, dto.managerId);
          if (!manager)
            throw unprocessable('Manager not found', [
              { field: 'managerId', message: 'Manager not found' },
            ]);
          if (manager.status !== 'active') {
            throw unprocessable('The manager must be an active employee', [
              { field: 'managerId', message: 'Manager is not an active employee' },
            ]);
          }
          if (await this.repository.isSelfOrDescendant(tx, employeeId, dto.managerId)) {
            throw unprocessable(
              'That would make a reporting loop: this person already reports to the employee',
              [
                {
                  field: 'managerId',
                  message: 'The manager reports, directly or not, to this employee',
                },
              ],
            );
          }
        }

        await this.repository.setManager(tx, employeeId, dto.managerId);
        await audit.record(
          {
            action: 'employee.manager_change',
            outcome: 'success',
            entityType: 'employee',
            entityId: employeeId,
            changes: { managerId: { from: current.managerId, to: dto.managerId } },
          },
          { transaction: tx },
        );
        events.add({
          type: 'employee.manager_changed',
          payload: { employeeId, from: current.managerId, to: dto.managerId },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
        return this.repository.loadChange(tx, employeeId);
      });
      await events.flush(this.platform.events);
      return change;
    } catch (err) {
      await audit.tryRecord({
        action: 'employee.manager_change',
        outcome: 'failure',
        entityType: 'employee',
        entityId: employeeId,
      });
      throw err;
    }
  }
}
