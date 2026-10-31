import { randomUUID } from 'node:crypto';
import { conflict } from '../../http/errors';
import type { ScopeFilter } from '../rbac';
import { IProjectsRepository, ListProjectsParams } from './projects.repository';
import {
  NewProject,
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectTx,
  ProjectValues,
} from './projects.types';

export interface MemoryPerson {
  name: string;
  managerId: string | null;
  active: boolean;
  /** Holds the Team Lead or Admin role. */
  canOwn: boolean;
}

/** In-memory projects for unit and HTTP tests (not shipped in the build). */
export class MemoryProjectsRepository implements IProjectsRepository {
  projects: Project[] = [];
  members: Array<{ projectId: string; employeeId: string; addedAt: string }> = [];
  people: Record<string, MemoryPerson> = {};

  async transaction<T>(work: (tx: ProjectTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({ projects: this.projects, members: this.members });
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as ProjectTx);
    } catch (err) {
      this.projects = snapshot.projects;
      this.members = snapshot.members;
      throw err;
    }
  }

  private memberIds(projectId: string): string[] {
    return this.members.filter((m) => m.projectId === projectId).map((m) => m.employeeId);
  }

  private visible(project: Project, filter: ScopeFilter): boolean {
    if (filter.kind === 'all') return true;
    if (filter.kind !== 'own') return false;
    return (
      project.ownerEmployeeId === filter.employeeId ||
      this.memberIds(project.id).includes(filter.employeeId)
    );
  }

  private withCount(project: Project): Project {
    return { ...project, memberCount: this.memberIds(project.id).length };
  }

  async list(params: ListProjectsParams) {
    const q = params.q?.toLowerCase();
    const matching = this.projects
      .filter(
        (p) =>
          this.visible(p, params.filter) &&
          (!params.status || p.status === params.status) &&
          (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.status.localeCompare(b.status) || a.name.localeCompare(b.name));
    return {
      items: matching
        .slice(params.offset, params.offset + params.limit)
        .map((p) => this.withCount(p)),
      total: matching.length,
    };
  }

  async findDetail(id: string, filter: ScopeFilter): Promise<ProjectDetail | null> {
    const project = this.projects.find((p) => p.id === id);
    if (!project || !this.visible(project, filter)) return null;
    return {
      ...this.withCount(project),
      members: this.members
        .filter((m) => m.projectId === id)
        .map((m) => ({
          employeeId: m.employeeId,
          name: this.people[m.employeeId]?.name ?? m.employeeId,
          addedAt: m.addedAt,
        })),
    };
  }

  async lockForUpdate(_tx: ProjectTx, id: string): Promise<Project | null> {
    const found = this.projects.find((p) => p.id === id);
    return found ? this.withCount(found) : null;
  }

  async insert(_tx: ProjectTx, input: NewProject): Promise<string> {
    if (this.projects.some((p) => p.code === input.code)) {
      throw conflict('A project with this code already exists');
    }
    const now = new Date().toISOString();
    const project: Project = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description,
      status: 'active',
      ownerEmployeeId: input.ownerEmployeeId,
      ownerName: this.people[input.ownerEmployeeId]?.name ?? input.ownerEmployeeId,
      startDate: input.startDate,
      endDate: input.endDate,
      version: 1,
      memberCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.projects.push(project);
    return project.id;
  }

  async update(_tx: ProjectTx, id: string, values: ProjectValues): Promise<void> {
    const found = this.projects.find((p) => p.id === id);
    if (!found) return;
    Object.assign(found, values, {
      version: found.version + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  async addMembers(_tx: ProjectTx, projectId: string, employeeIds: string[]): Promise<number> {
    let added = 0;
    for (const employeeId of employeeIds) {
      if (this.memberIds(projectId).includes(employeeId)) continue;
      this.members.push({ projectId, employeeId, addedAt: new Date().toISOString() });
      added += 1;
    }
    return added;
  }

  async removeMember(_tx: ProjectTx, projectId: string, employeeId: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter(
      (m) => !(m.projectId === projectId && m.employeeId === employeeId),
    );
    return this.members.length < before;
  }

  async isEligibleOwner(_tx: ProjectTx, employeeId: string): Promise<boolean> {
    const person = this.people[employeeId];
    return !!person && person.active && person.canOwn;
  }

  async ineligibleMembers(
    _tx: ProjectTx,
    ownerId: string,
    employeeIds: string[],
  ): Promise<string[]> {
    return employeeIds.filter((id) => {
      const person = this.people[id];
      return !person || !person.active || !(id === ownerId || person.managerId === ownerId);
    });
  }

  async access(projectId: string): Promise<ProjectAccess | null> {
    const project = this.projects.find((p) => p.id === projectId);
    return project
      ? {
          status: project.status,
          ownerEmployeeId: project.ownerEmployeeId,
          memberEmployeeIds: this.memberIds(projectId),
        }
      : null;
  }
}
