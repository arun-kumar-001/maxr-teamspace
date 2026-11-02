import { createHash } from 'node:crypto';
import { PaginatedResponse } from '@maxr/shared';
import { conflict, forbidden, notFound } from '../../../http/errors';
import { buildPage, toOffsetLimit } from '../../../http/pagination';
import type { Logger } from '../../../logging/logger';
import type { PlatformServices } from '../../../platform';
import type { RawUpload } from '../../../http/raw-upload';
import type { Task, TaskViewer } from '../tasks.types';
import { ICollaborationRepository } from './collaboration.repository';
import type { AddCommentInput, ListCommentsQuery } from './collaboration.schemas';
import { StoredAttachment, TaskAttachment, TaskComment } from './collaboration.types';

type Deps = Pick<PlatformServices, 'audit' | 'events' | 'storage'>;

export interface CollabCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

/** Task visibility is the access rule: the service only needs to ask for a task the viewer may see. */
export interface TaskLookup {
  get(id: string, viewer: TaskViewer): Promise<Task>;
}

const visible = ({ storageKey: _key, ...rest }: StoredAttachment): TaskAttachment => rest;

export class TaskCollaborationService {
  constructor(
    private readonly repository: ICollaborationRepository,
    private readonly platform: Deps,
    private readonly tasks: TaskLookup,
    private readonly logger: Logger,
  ) {}

  async listComments(
    taskId: string,
    query: ListCommentsQuery,
    viewer: TaskViewer,
  ): Promise<PaginatedResponse<TaskComment>> {
    await this.tasks.get(taskId, viewer);
    const { items, total } = await this.repository.listComments(taskId, ...this.window(query));
    return buildPage(items, total, query);
  }

  private window(query: ListCommentsQuery): [number, number] {
    const { offset, limit } = toOffsetLimit(query);
    return [offset, limit];
  }

  /** Anyone who can see the task can comment. The assignee and the assigner hear of it. */
  async addComment(
    taskId: string,
    input: AddCommentInput,
    caller: CollabCaller,
    viewer: TaskViewer,
  ): Promise<TaskComment> {
    const task = await this.tasks.get(taskId, viewer);
    const comment = await this.repository.insertComment(taskId, caller.employeeId, input.body);
    // The text of a comment is free text: the trail records that one was made, not what it said.
    await this.platform.audit
      .withContext({ actorId: caller.actorId, requestId: caller.requestId })
      .record({
        action: 'task.comment',
        outcome: 'success',
        entityType: 'task',
        entityId: taskId,
        metadata: { commentId: comment.id },
      });
    await this.platform.events.emit({
      type: 'tasks.commented',
      payload: {
        taskId,
        assigneeEmployeeId: task.assigneeEmployeeId,
        assignerEmployeeId: task.assignerEmployeeId,
        authorEmployeeId: caller.employeeId,
      },
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return comment;
  }

  async listAttachments(taskId: string, viewer: TaskViewer): Promise<TaskAttachment[]> {
    await this.tasks.get(taskId, viewer);
    return (await this.repository.listAttachments(taskId)).map(visible);
  }

  /**
   * Stores the file through the storage service (type by content, size limit, virus scan), then
   * records it. The same file is attached to a task once (409). If recording fails the stored
   * object is removed again.
   */
  async addAttachment(
    taskId: string,
    file: RawUpload,
    caller: CollabCaller,
    viewer: TaskViewer,
  ): Promise<TaskAttachment> {
    await this.tasks.get(taskId, viewer);
    const sha256 = createHash('sha256').update(file.body).digest('hex');
    if (await this.repository.hasAttachmentWithHash(taskId, sha256)) {
      throw conflict('This file is already attached to the task');
    }
    const stored = await this.platform.storage.upload({
      category: 'taskAttachments',
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
      return visible(
        await this.repository.transaction(async (tx) => {
          const attachment = await this.repository.insertAttachment(tx, {
            taskId,
            uploadedByEmployeeId: caller.employeeId,
            storageKey: stored.key,
            originalName: stored.originalName,
            contentType: stored.contentType,
            size: stored.size,
            sha256: stored.sha256,
          });
          // File names can name people or clients: the trail holds the id, type and size only.
          await audit.record(
            {
              action: 'task.attachment_add',
              outcome: 'success',
              entityType: 'task',
              entityId: taskId,
              metadata: {
                attachmentId: attachment.id,
                contentType: stored.contentType,
                size: stored.size,
              },
            },
            { transaction: tx },
          );
          return attachment;
        }),
      );
    } catch (err) {
      await this.discard(stored.key);
      throw err;
    }
  }

  /** A short-lived link bound to the caller's session, issued only after the task visibility check. */
  async downloadLink(
    taskId: string,
    attachmentId: string,
    caller: CollabCaller,
    viewer: TaskViewer,
  ): Promise<{ url: string; expiresAt: string }> {
    await this.tasks.get(taskId, viewer);
    const attachment = await this.repository.findAttachment(taskId, attachmentId);
    if (!attachment) throw notFound('Attachment not found');
    const link = await this.platform.storage.createDownloadLink(attachment.storageKey, {
      subject: caller.actorId,
    });
    return { url: link.url, expiresAt: link.expiresAt };
  }

  /** The person who uploaded a file, the person who assigned the task, or an Admin can remove it. */
  async removeAttachment(
    taskId: string,
    attachmentId: string,
    caller: CollabCaller,
    viewer: TaskViewer,
  ): Promise<void> {
    const task = await this.tasks.get(taskId, viewer);
    const attachment = await this.repository.findAttachment(taskId, attachmentId);
    if (!attachment) throw notFound('Attachment not found');
    if (
      attachment.uploadedByEmployeeId !== caller.employeeId &&
      task.assignerEmployeeId !== caller.employeeId &&
      !viewer.all
    ) {
      throw forbidden(
        'Only the person who attached it, the person who assigned the task, or an Admin can remove a file',
      );
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await this.repository.transaction(async (tx) => {
      await this.repository.deleteAttachment(tx, attachmentId);
      await audit.record(
        {
          action: 'task.attachment_remove',
          outcome: 'success',
          entityType: 'task',
          entityId: taskId,
          metadata: { attachmentId },
        },
        { transaction: tx },
      );
    });
    // After the commit: a failure here leaves an unreachable object, never a dangling record.
    await this.discard(attachment.storageKey);
  }

  private async discard(key: string): Promise<void> {
    try {
      await this.platform.storage.delete(key);
    } catch (err) {
      this.logger.error('stored task file could not be removed', { key, err });
    }
  }
}
