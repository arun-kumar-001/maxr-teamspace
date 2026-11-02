import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import type { ScopeFilter } from '../rbac';
import { IProjectsRepository } from './projects.repository';
import type { CreateProjectInput, ListProjectsQuery, UpdateProjectInput } from './projects.schemas';
import {
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectReader,
  ProjectValues,
} from './projects.types';

type Deps = Pick<PlatformServices, 'audit'>;

export interface ProjectCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const ALL: ScopeFilter = { kind: 'all' };

export class ProjectsService implements ProjectReader {
  constructor(
    private readonly repository: IProjectsRepository,
    private readonly platform: Deps,
  ) {}

  async list(
    query: ListProjectsQuery,
    readFilter: ScopeFilter,
  ): Promise<PaginatedResponse<Project>> {
    const { items, total } = await this.repository.list({
      filter: readFilter,
      status: query.status,
      q: query.q,
      ...toOffsetLimit(query),
    });
    return buildPage(items, total, query);
  }

  async get(id: string, readFilter: ScopeFilter): Promise<ProjectDetail> {
    const found = await this.repository.findDetail(id, readFilter);
    // A project you cannot see looks exactly like one that does not exist.
    if (!found) throw notFound('Project not found');
    return found;
  }

  access(projectId: string): Promise<ProjectAccess | null> {
    return this.repository.access(projectId);
  }

  /**
   * A Team Lead owns what they create; an Admin may name another Team Lead or Admin as owner.
   * Members must be active and be the owner or one of the owner's direct reports (D-14).
   */
  async create(
    input: CreateProjectInput,
    caller: ProjectCaller,
    manageScope: ScopeFilter,
  ): Promise<ProjectDetail> {
    const ownerId = input.ownerEmployeeId ?? caller.employeeId;
    if (ownerId !== caller.employeeId && manageScope.kind !== 'all') {
      throw forbidden('Only an Admin can give a project another owner');
    }
    const memberIds = [...new Set(input.memberIds ?? [])].filter((id) => id !== ownerId);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const id = await this.repository.transaction(async (tx) => {
      if (!(await this.repository.isEligibleOwner(tx, ownerId))) {
        throw unprocessable('The owner must be an active Team Lead or Admin');
      }
      await this.assertMembersEligible(tx, ownerId, memberIds);
      const projectId = await this.repository.insert(tx, {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        ownerEmployeeId: ownerId,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      });
      await this.repository.addMembers(tx, projectId, [ownerId, ...memberIds]);
      await audit.record(
        {
          action: 'project.create',
          outcome: 'success',
          entityType: 'project',
          entityId: projectId,
          changes: { code: input.code, ownerEmployeeId: ownerId, members: memberIds.length + 1 },
        },
        { transaction: tx },
      );
      return projectId;
    });
    return this.get(id, ALL);
  }

  async update(
    id: string,
    input: UpdateProjectInput,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectDetail> {
    await this.get(id, readFilter);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await this.repository.transaction(async (tx) => {
      const current = await this.lockManageable(tx, id, caller, manageScope);
      if (current.version !== input.version) {
        throw conflict('This project was changed by someone else; reload it and try again');
      }
      const next: ProjectValues = {
        name: input.name ?? current.name,
        description: input.description === undefined ? current.description : input.description,
        status: input.status ?? current.status,
        startDate: input.startDate === undefined ? current.startDate : input.startDate,
        endDate: input.endDate === undefined ? current.endDate : input.endDate,
      };
      if (next.startDate && next.endDate && next.endDate < next.startDate) {
        throw unprocessable('The end date must be on or after the start date');
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of ['name', 'description', 'status', 'startDate', 'endDate'] as const) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      if (Object.keys(changes).length === 0) return;
      if (current.status === 'archived' && next.status === 'archived') {
        throw unprocessable('An archived project is read-only; reactivate it first');
      }
      await this.repository.update(tx, id, next);
      await audit.record(
        {
          action:
            next.status !== current.status
              ? `project.${next.status === 'archived' ? 'archive' : 'reactivate'}`
              : 'project.update',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          changes,
        },
        { transaction: tx },
      );
    });
    return this.get(id, readFilter);
  }

  async addMember(
    id: string,
    employeeId: string,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectDetail> {
    await this.get(id, readFilter);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await this.repository.transaction(async (tx) => {
      const project = await this.lockManageable(tx, id, caller, manageScope);
      this.assertActive(project);
      await this.assertMembersEligible(tx, project.ownerEmployeeId, [employeeId]);
      const added = await this.repository.addMembers(tx, id, [employeeId]);
      // Adding someone who is already in is harmless and leaves no entry.
      if (added === 0) return;
      await audit.record(
        {
          action: 'project.member_add',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          changes: { memberEmployeeId: { from: null, to: employeeId } },
        },
        { transaction: tx },
      );
    });
    return this.get(id, readFilter);
  }

  async removeMember(
    id: string,
    employeeId: string,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectDetail> {
    await this.get(id, readFilter);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await this.repository.transaction(async (tx) => {
      const project = await this.lockManageable(tx, id, caller, manageScope);
      this.assertActive(project);
      if (employeeId === project.ownerEmployeeId) {
        throw unprocessable('The owner cannot be removed from their own project');
      }
      if (!(await this.repository.removeMember(tx, id, employeeId))) {
        throw notFound('That employee is not a member of this project');
      }
      await audit.record(
        {
          action: 'project.member_remove',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          changes: { memberEmployeeId: { from: employeeId, to: null } },
        },
        { transaction: tx },
      );
    });
    return this.get(id, readFilter);
  }

  /** Locks the project and checks the caller may change it: its owner, or an Admin. */
  private async lockManageable(
    tx: Parameters<IProjectsRepository['lockForUpdate']>[0],
    id: string,
    caller: ProjectCaller,
    manageScope: ScopeFilter,
  ): Promise<Project> {
    const project = await this.repository.lockForUpdate(tx, id);
    if (!project) throw notFound('Project not found');
    if (manageScope.kind !== 'all' && project.ownerEmployeeId !== caller.employeeId) {
      throw forbidden('Only the project owner or an Admin can change this project');
    }
    return project;
  }

  private assertActive(project: Project): void {
    if (project.status !== 'active') {
      throw unprocessable('An archived project is read-only; reactivate it first');
    }
  }

  private async assertMembersEligible(
    tx: Parameters<IProjectsRepository['ineligibleMembers']>[0],
    ownerId: string,
    employeeIds: string[],
  ): Promise<void> {
    const bad = await this.repository.ineligibleMembers(tx, ownerId, employeeIds);
    if (bad.length > 0) {
      throw unprocessable(
        'Members must be active and be the owner or one of the owner’s direct reports',
        bad.map((value) => ({ field: 'memberIds', message: value })),
      );
    }
  }
}
