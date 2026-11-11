import { randomUUID } from 'node:crypto';
import { conflict } from '../../http/errors';
import type { ScopeFilter } from '../rbac';
import { IProjectsRepository, ListProjectsParams } from './projects.repository';
import {
  MilestoneValues,
  NewMilestone,
  NewProject,
  NewProjectDocument,
  NewProjectUpdate,
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectMilestone,
  ProjectsSummary,
  ProjectTx,
  ProjectUpdate,
  ProjectValues,
  ProjectWorkflowStatus,
  StoredProjectDocument,
} from './projects.types';

export interface MemoryPerson {
  name: string;
  email?: string;
  designation?: string;
  department?: string;
  managerId: string | null;
  active: boolean;
  /** Holds the Team Lead or Admin role. */
  canOwn: boolean;
}

/** In-memory projects for unit and HTTP tests (not shipped in the build). */
export class MemoryProjectsRepository implements IProjectsRepository {
  projects: Project[] = [];
  members: Array<{ projectId: string; employeeId: string; addedAt: string }> = [];
  milestones: ProjectMilestone[] = [];
  updates: ProjectUpdate[] = [];
  documents: Array<StoredProjectDocument & { sha256: string }> = [];
  people: Record<string, MemoryPerson> = {};

  async transaction<T>(work: (tx: ProjectTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone({
      projects: this.projects,
      members: this.members,
      milestones: this.milestones,
      updates: this.updates,
      documents: this.documents,
    });
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as ProjectTx);
    } catch (err) {
      this.projects = snapshot.projects;
      this.members = snapshot.members;
      this.milestones = snapshot.milestones;
      this.updates = snapshot.updates;
      this.documents = snapshot.documents;
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

  async list(params: ListProjectsParams): Promise<{
    items: Project[];
    total: number;
    summary: ProjectsSummary;
  }> {
    const visibleProjects = this.projects.filter((p) => this.visible(p, params.filter));
    const activeVisible = visibleProjects.filter((p) => p.status === 'active');
    const summary: ProjectsSummary = {
      totalAssigned: activeVisible.length,
      inProgress: activeVisible.filter((p) => p.workflowStatus === 'in_progress').length,
      completed: activeVisible.filter((p) => p.workflowStatus === 'completed').length,
      upcoming: activeVisible.filter((p) => p.workflowStatus === 'not_started').length,
      onHold: activeVisible.filter((p) => p.workflowStatus === 'on_hold').length,
    };

    const q = params.q?.toLowerCase();
    const matching = visibleProjects
      .filter(
        (p) =>
          (!params.status || p.status === params.status) &&
          (!params.workflowStatus || p.workflowStatus === params.workflowStatus) &&
          (!params.priority || p.priority === params.priority) &&
          (!q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)),
      )
      .sort((a, b) => {
        if (params.sort === 'deadline_asc') {
          return (
            a.status.localeCompare(b.status) ||
            (a.endDate ?? '9999-12-31').localeCompare(b.endDate ?? '9999-12-31') ||
            a.name.localeCompare(b.name)
          );
        }
        if (params.sort === 'deadline_desc') {
          return (
            a.status.localeCompare(b.status) ||
            (b.endDate ?? '0000-01-01').localeCompare(a.endDate ?? '0000-01-01') ||
            a.name.localeCompare(b.name)
          );
        }
        return a.status.localeCompare(b.status) || a.name.localeCompare(b.name);
      });
    return {
      items: matching
        .slice(params.offset, params.offset + params.limit)
        .map((p) => this.withCount(p)),
      total: matching.length,
      summary,
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
          email: this.people[m.employeeId]?.email ?? null,
          designation: this.people[m.employeeId]?.designation ?? null,
          department: this.people[m.employeeId]?.department ?? null,
          addedAt: m.addedAt,
        })),
      milestones: this.milestones
        .filter((m) => m.projectId === id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id)),
      updates: this.updates
        .filter((u) => u.projectId === id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
      documents: this.documents
        .filter((d) => d.projectId === id)
        .map(({ storageKey: _k, sha256: _s, ...doc }) => doc)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
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
    const owner = this.people[input.ownerEmployeeId];
    const project: Project = {
      id: randomUUID(),
      code: input.code,
      name: input.name,
      description: input.description,
      status: 'active',
      priority: input.priority ?? 'medium',
      workflowStatus: input.workflowStatus ?? 'in_progress',
      progressPercent: input.progressPercent ?? 0,
      objectives: input.objectives ?? null,
      scope: input.scope ?? null,
      technologies: input.technologies ?? [],
      ownerEmployeeId: input.ownerEmployeeId,
      ownerName: owner?.name ?? input.ownerEmployeeId,
      ownerEmail: owner?.email ?? null,
      ownerDesignation: owner?.designation ?? null,
      ownerDepartment: owner?.department ?? null,
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

  async insertMilestone(_tx: ProjectTx, input: NewMilestone): Promise<ProjectMilestone> {
    const now = new Date().toISOString();
    const sortOrder =
      this.milestones
        .filter((m) => m.projectId === input.projectId)
        .reduce((max, m) => Math.max(max, m.sortOrder), 0) + 1;
    const milestone: ProjectMilestone = {
      id: randomUUID(),
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      startDate: input.startDate,
      dueDate: input.dueDate,
      status: input.status,
      completionPercent: input.completionPercent,
      sortOrder,
      createdAt: now,
      updatedAt: now,
    };
    this.milestones.push(milestone);
    return milestone;
  }

  async findMilestone(
    _tx: ProjectTx,
    projectId: string,
    milestoneId: string,
  ): Promise<ProjectMilestone | null> {
    return this.milestones.find((m) => m.projectId === projectId && m.id === milestoneId) ?? null;
  }

  async updateMilestone(
    _tx: ProjectTx,
    milestoneId: string,
    values: MilestoneValues,
  ): Promise<ProjectMilestone> {
    const found = this.milestones.find((m) => m.id === milestoneId);
    if (!found) throw new Error('Milestone not found');
    Object.assign(found, values, { updatedAt: new Date().toISOString() });
    return found;
  }

  async insertUpdate(_tx: ProjectTx, input: NewProjectUpdate): Promise<ProjectUpdate> {
    const person = this.people[input.authorEmployeeId];
    const entry: ProjectUpdate = {
      id: randomUUID(),
      projectId: input.projectId,
      authorEmployeeId: input.authorEmployeeId,
      authorName: person?.name ?? input.authorEmployeeId,
      authorRoleLabel: person?.designation ?? null,
      updateType: input.updateType,
      content: input.content,
      progressPercent: input.progressPercent,
      createdAt: new Date().toISOString(),
    };
    this.updates.unshift(entry);
    return entry;
  }

  async updateProgress(
    _tx: ProjectTx,
    projectId: string,
    progressPercent: number,
    workflowStatus?: ProjectWorkflowStatus,
  ): Promise<void> {
    const found = this.projects.find((p) => p.id === projectId);
    if (!found) return;
    found.progressPercent = progressPercent;
    if (workflowStatus) found.workflowStatus = workflowStatus;
    found.updatedAt = new Date().toISOString();
  }

  async hasDocumentWithHash(projectId: string, sha256: string): Promise<boolean> {
    return this.documents.some((d) => d.projectId === projectId && d.sha256 === sha256);
  }

  async insertDocument(_tx: ProjectTx, input: NewProjectDocument): Promise<StoredProjectDocument> {
    const person = this.people[input.uploadedByEmployeeId];
    const doc = {
      id: randomUUID(),
      projectId: input.projectId,
      uploadedByEmployeeId: input.uploadedByEmployeeId,
      uploadedByName: person?.name ?? input.uploadedByEmployeeId,
      storageKey: input.storageKey,
      originalName: input.originalName,
      contentType: input.contentType,
      size: input.size,
      sha256: input.sha256,
      category: input.category,
      createdAt: new Date().toISOString(),
    };
    this.documents.push(doc);
    const { sha256: _s, ...stored } = doc;
    return stored;
  }

  async findDocument(projectId: string, documentId: string): Promise<StoredProjectDocument | null> {
    const found = this.documents.find((d) => d.projectId === projectId && d.id === documentId);
    if (!found) return null;
    const { sha256: _s, ...stored } = found;
    return stored;
  }

  async deleteDocument(_tx: ProjectTx, documentId: string): Promise<void> {
    this.documents = this.documents.filter((d) => d.id !== documentId);
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
