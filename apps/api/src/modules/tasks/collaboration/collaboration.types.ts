import type { PoolClient } from 'pg';

export type CollabTx = Pick<PoolClient, 'query'>;

/** A task holds at most this many files. */
export const MAX_ATTACHMENTS_PER_TASK = 20;

export interface TaskComment {
  id: string;
  taskId: string;
  authorEmployeeId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

/** What a client sees of an attachment: never the storage key or the hash. */
export interface TaskAttachment {
  id: string;
  taskId: string;
  uploadedByEmployeeId: string;
  uploadedByName: string;
  originalName: string;
  contentType: string;
  size: number;
  createdAt: string;
}

/** The attachment as stored, including what only the server may know. */
export interface StoredAttachment extends TaskAttachment {
  storageKey: string;
}

export interface NewAttachment {
  taskId: string;
  uploadedByEmployeeId: string;
  storageKey: string;
  originalName: string;
  contentType: string;
  size: number;
  sha256: string;
}
