import { randomUUID } from 'node:crypto';
import { conflict, unprocessable } from '../../../http/errors';
import { ICollaborationRepository } from './collaboration.repository';
import {
  CollabTx,
  MAX_ATTACHMENTS_PER_TASK,
  NewAttachment,
  StoredAttachment,
  TaskComment,
} from './collaboration.types';

/** In-memory comments and attachments for unit and HTTP tests (not shipped in the build). */
export class MemoryCollaborationRepository implements ICollaborationRepository {
  comments: TaskComment[] = [];
  attachments: Array<StoredAttachment & { sha256: string }> = [];
  names: Record<string, string> = {};

  async transaction<T>(work: (tx: CollabTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.attachments);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as CollabTx);
    } catch (err) {
      this.attachments = snapshot;
      throw err;
    }
  }

  private name(id: string): string {
    return this.names[id] ?? id;
  }

  async insertComment(
    taskId: string,
    authorEmployeeId: string,
    body: string,
  ): Promise<TaskComment> {
    const comment: TaskComment = {
      id: randomUUID(),
      taskId,
      authorEmployeeId,
      authorName: this.name(authorEmployeeId),
      body,
      createdAt: new Date(Date.now() + this.comments.length).toISOString(),
    };
    this.comments.push(comment);
    return { ...comment };
  }

  async listComments(taskId: string, offset: number, limit: number) {
    const all = this.comments.filter((c) => c.taskId === taskId);
    return { items: all.slice(offset, offset + limit).map((c) => ({ ...c })), total: all.length };
  }

  async insertAttachment(_tx: CollabTx, input: NewAttachment): Promise<StoredAttachment> {
    const onTask = this.attachments.filter((a) => a.taskId === input.taskId);
    if (onTask.length >= MAX_ATTACHMENTS_PER_TASK) {
      throw unprocessable(`A task can hold at most ${MAX_ATTACHMENTS_PER_TASK} files`);
    }
    if (onTask.some((a) => a.sha256 === input.sha256)) {
      throw conflict('This file is already attached to the task');
    }
    const stored = {
      id: randomUUID(),
      taskId: input.taskId,
      uploadedByEmployeeId: input.uploadedByEmployeeId,
      uploadedByName: this.name(input.uploadedByEmployeeId),
      storageKey: input.storageKey,
      originalName: input.originalName,
      contentType: input.contentType,
      size: input.size,
      sha256: input.sha256,
      createdAt: new Date().toISOString(),
    };
    this.attachments.push(stored);
    const { sha256: _hash, ...visible } = stored;
    return visible;
  }

  async hasAttachmentWithHash(taskId: string, sha256: string): Promise<boolean> {
    return this.attachments.some((a) => a.taskId === taskId && a.sha256 === sha256);
  }

  async listAttachments(taskId: string): Promise<StoredAttachment[]> {
    return this.attachments
      .filter((a) => a.taskId === taskId)
      .map(({ sha256: _hash, ...visible }) => visible);
  }

  async findAttachment(taskId: string, attachmentId: string): Promise<StoredAttachment | null> {
    const found = this.attachments.find((a) => a.taskId === taskId && a.id === attachmentId);
    if (!found) return null;
    const { sha256: _hash, ...visible } = found;
    return visible;
  }

  async deleteAttachment(_tx: CollabTx, attachmentId: string): Promise<void> {
    this.attachments = this.attachments.filter((a) => a.id !== attachmentId);
  }
}
