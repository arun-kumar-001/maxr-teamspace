import { createHash } from 'node:crypto';
import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { RawUpload } from '../../http/raw-upload';
import type { PlatformServices } from '../../platform';
import type { ScopeFilter } from '../rbac';
import { IProjectsRepository } from './projects.repository';
import type {
  CreateMilestoneInput,
  CreateProjectInput,
  CreateProjectUpdateInput,
  ListProjectsQuery,
  UpdateMilestoneInput,
  UpdateProjectInput,
} from './projects.schemas';
import {
  MilestoneValues,
  Project,
  ProjectAccess,
  ProjectDetail,
  ProjectDocument,
  ProjectDocumentCategory,
  ProjectMilestone,
  ProjectReader,
  ProjectsSummary,
  ProjectUpdate,
  ProjectValues,
  ProjectWorkflowStatus,
  StoredProjectDocument,
} from './projects.types';

type Deps = Pick<PlatformServices, 'audit' | 'storage'>;

export interface ProjectCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const ALL: ScopeFilter = { kind: 'all' };

const publicDoc = ({ storageKey: _key, ...rest }: StoredProjectDocument): ProjectDocument => rest;

export interface ProjectListResult extends PaginatedResponse<Project> {
  summary: ProjectsSummary;
}

export class ProjectsService implements ProjectReader {
  constructor(
    private readonly repository: IProjectsRepository,
    private readonly platform: Deps,
  ) {}

  async list(query: ListProjectsQuery, readFilter: ScopeFilter): Promise<ProjectListResult> {
    const { items, total, summary } = await this.repository.list({
      filter: readFilter,
      status: query.status,
      workflowStatus: query.workflowStatus,
      priority: query.priority,
      sort: query.sort,
      q: query.q,
      ...toOffsetLimit(query),
    });
    return {
      ...buildPage(items, total, query),
      summary,
    };
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
        priority: input.priority ?? 'medium',
        workflowStatus: input.workflowStatus ?? 'in_progress',
        progressPercent: input.progressPercent ?? 0,
        objectives: input.objectives ?? null,
        scope: input.scope ?? null,
        technologies: input.technologies ?? [],
      });
      await this.repository.addMembers(tx, projectId, [ownerId, ...memberIds]);
      await this.repository.insertUpdate(tx, {
        projectId,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: `Project ${input.code} created with ${memberIds.length + 1} team member(s).`,
        progressPercent: input.progressPercent ?? 0,
      });
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
        priority: input.priority ?? current.priority,
        workflowStatus: input.workflowStatus ?? current.workflowStatus,
        progressPercent: input.progressPercent ?? current.progressPercent,
        objectives: input.objectives === undefined ? current.objectives : input.objectives,
        scope: input.scope === undefined ? current.scope : input.scope,
        technologies: input.technologies === undefined ? current.technologies : input.technologies,
      };
      if (next.startDate && next.endDate && next.endDate < next.startDate) {
        throw unprocessable('The end date must be on or after the start date');
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of [
        'name',
        'description',
        'status',
        'startDate',
        'endDate',
        'priority',
        'workflowStatus',
        'progressPercent',
        'objectives',
        'scope',
      ] as const) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      if (JSON.stringify(current.technologies) !== JSON.stringify(next.technologies)) {
        changes.technologies = { from: current.technologies, to: next.technologies };
      }
      if (Object.keys(changes).length === 0) return;
      if (current.status === 'archived' && next.status === 'archived') {
        throw unprocessable('An archived project is read-only; reactivate it first');
      }
      await this.repository.update(tx, id, next);
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: `Project settings updated (${Object.keys(changes).join(', ')}).`,
        progressPercent: next.progressPercent,
      });
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
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: 'Added a new team member to the project.',
        progressPercent: null,
      });
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
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: 'Removed a team member from the project.',
        progressPercent: null,
      });
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

  async addMilestone(
    id: string,
    input: CreateMilestoneInput,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectMilestone> {
    await this.get(id, readFilter);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const project = await this.lockManageable(tx, id, caller, manageScope);
      this.assertActive(project);
      const milestone = await this.repository.insertMilestone(tx, {
        projectId: id,
        title: input.title,
        description: input.description ?? null,
        startDate: input.startDate ?? null,
        dueDate: input.dueDate ?? null,
        status: input.status ?? 'not_started',
        completionPercent: input.completionPercent ?? 0,
      });
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: `Added milestone "${milestone.title}".`,
        progressPercent: null,
      });
      await audit.record(
        {
          action: 'project.milestone_create',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          metadata: { milestoneId: milestone.id },
        },
        { transaction: tx },
      );
      return milestone;
    });
  }

  async updateMilestone(
    id: string,
    milestoneId: string,
    input: UpdateMilestoneInput,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectMilestone> {
    await this.get(id, readFilter);
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const project = await this.lockManageable(tx, id, caller, manageScope);
      this.assertActive(project);
      const current = await this.repository.findMilestone(tx, id, milestoneId);
      if (!current) throw notFound('Milestone not found');
      const next: MilestoneValues = {
        title: input.title ?? current.title,
        description: input.description === undefined ? current.description : input.description,
        startDate: input.startDate === undefined ? current.startDate : input.startDate,
        dueDate: input.dueDate === undefined ? current.dueDate : input.dueDate,
        status: input.status ?? current.status,
        completionPercent: input.completionPercent ?? current.completionPercent,
      };
      if (next.startDate && next.dueDate && next.dueDate < next.startDate) {
        throw unprocessable('The due date must be on or after the start date');
      }
      const updated = await this.repository.updateMilestone(tx, milestoneId, next);
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: `Updated milestone "${updated.title}" (${updated.completionPercent}% complete).`,
        progressPercent: null,
      });
      await audit.record(
        {
          action: 'project.milestone_update',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          metadata: { milestoneId },
        },
        { transaction: tx },
      );
      return updated;
    });
  }

  async addUpdate(
    id: string,
    input: CreateProjectUpdateInput,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<ProjectUpdate> {
    const visible = await this.get(id, readFilter);
    if (
      input.updateType === 'manager_update' &&
      manageScope.kind !== 'all' &&
      visible.ownerEmployeeId !== caller.employeeId
    ) {
      throw forbidden('Only the project manager or an Admin can post manager updates');
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const project = await this.repository.lockForUpdate(tx, id);
      if (!project) throw notFound('Project not found');
      this.assertActive(project);

      const nextProgress =
        input.updateType !== 'comment' && input.progressPercent !== undefined
          ? input.progressPercent
          : null;

      if (nextProgress !== null) {
        let nextWorkflow: ProjectWorkflowStatus | undefined;
        if (nextProgress === 100) {
          nextWorkflow = 'completed';
        } else if (nextProgress > 0 && project.workflowStatus === 'not_started') {
          nextWorkflow = 'in_progress';
        }
        await this.repository.updateProgress(tx, id, nextProgress, nextWorkflow);
      }

      const entry = await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: input.updateType,
        content: input.content,
        progressPercent: nextProgress,
      });

      await audit.record(
        {
          action: 'project.update_post',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          metadata: { updateId: entry.id, updateType: entry.updateType },
        },
        { transaction: tx },
      );
      return entry;
    });
  }

  async uploadDocument(
    id: string,
    file: RawUpload,
    category: ProjectDocumentCategory,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
  ): Promise<ProjectDocument> {
    const visible = await this.get(id, readFilter);
    this.assertActive(visible);

    const sha256 = createHash('sha256').update(file.body).digest('hex');
    if (await this.repository.hasDocumentWithHash(id, sha256)) {
      throw conflict('This document is already attached to the project');
    }
    const stored = await this.platform.storage.upload({
      category: 'projectDocuments',
      filename: file.filename,
      declaredType: file.declaredType,
      body: file.body,
      uploadedBy: caller.actorId,
    });
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    try {
      return publicDoc(
        await this.repository.transaction(async (tx) => {
          const project = await this.repository.lockForUpdate(tx, id);
          if (!project) throw notFound('Project not found');
          this.assertActive(project);
          const doc = await this.repository.insertDocument(tx, {
            projectId: id,
            uploadedByEmployeeId: caller.employeeId,
            storageKey: stored.key,
            originalName: stored.originalName,
            contentType: stored.contentType,
            size: stored.size,
            sha256: stored.sha256,
            category,
          });
          await this.repository.insertUpdate(tx, {
            projectId: id,
            authorEmployeeId: caller.employeeId,
            updateType: 'activity',
            content: `Uploaded project document "${stored.originalName}".`,
            progressPercent: null,
          });
          await audit.record(
            {
              action: 'project.document_upload',
              outcome: 'success',
              entityType: 'project',
              entityId: id,
              metadata: {
                documentId: doc.id,
                contentType: stored.contentType,
                size: stored.size,
              },
            },
            { transaction: tx },
          );
          return doc;
        }),
      );
    } catch (err) {
      await this.platform.storage.delete(stored.key).catch(() => undefined);
      throw err;
    }
  }

  async downloadDocumentLink(
    id: string,
    documentId: string,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
  ): Promise<{ url: string; expiresAt: string }> {
    await this.get(id, readFilter);
    const doc = await this.repository.findDocument(id, documentId);
    if (!doc) throw notFound('Document not found');
    const link = await this.platform.storage.createDownloadLink(doc.storageKey, {
      subject: caller.actorId,
    });
    return { url: link.url, expiresAt: link.expiresAt };
  }

  async removeDocument(
    id: string,
    documentId: string,
    caller: ProjectCaller,
    readFilter: ScopeFilter,
    manageScope: ScopeFilter,
  ): Promise<void> {
    const visible = await this.get(id, readFilter);
    this.assertActive(visible);
    const doc = await this.repository.findDocument(id, documentId);
    if (!doc) throw notFound('Document not found');
    if (
      doc.uploadedByEmployeeId !== caller.employeeId &&
      visible.ownerEmployeeId !== caller.employeeId &&
      manageScope.kind !== 'all'
    ) {
      throw forbidden('Only the uploader, project manager, or an Admin can remove a document');
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await this.repository.transaction(async (tx) => {
      await this.repository.deleteDocument(tx, documentId);
      await this.repository.insertUpdate(tx, {
        projectId: id,
        authorEmployeeId: caller.employeeId,
        updateType: 'activity',
        content: `Removed project document "${doc.originalName}".`,
        progressPercent: null,
      });
      await audit.record(
        {
          action: 'project.document_remove',
          outcome: 'success',
          entityType: 'project',
          entityId: id,
          metadata: { documentId },
        },
        { transaction: tx },
      );
    });
    await this.platform.storage.delete(doc.storageKey).catch(() => undefined);
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

  private assertActive(project: Pick<Project, 'status'>): void {
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
