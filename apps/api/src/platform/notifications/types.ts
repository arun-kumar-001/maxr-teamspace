export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  html?: string;
}

export type OutboxStatus = 'pending' | 'processing' | 'sent' | 'dead';

export interface OutboxItem {
  id: string;
  channel: 'email';
  payload: EmailMessage;
  status: OutboxStatus;
  /** Counted when an item is claimed for sending. */
  attempts: number;
  nextAttemptAt: string;
  /** While `processing`, until this time no other worker may take the item. */
  lockedUntil: string | null;
  lastError: string | null;
  dedupeKey: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface NewOutboxItem {
  id: string;
  channel: 'email';
  payload: EmailMessage;
  dedupeKey?: string;
  now: Date;
}

/**
 * Durable queue of messages to send. The in-memory version is for tests and local development;
 * the SQL version (table contract in docs/architecture/shared-services.md) arrives with issue #6.
 */
export interface NotificationOutbox {
  /** Idempotent on `dedupeKey`: a second call returns the existing item. */
  enqueue(item: NewOutboxItem): Promise<OutboxItem>;
  /**
   * Atomically takes up to `limit` due items (pending and due, or processing with an expired
   * lock), marks them `processing`, locks them for `lockMs` and counts the attempt.
   */
  claimDue(limit: number, now: Date, lockMs: number): Promise<OutboxItem[]>;
  markSent(id: string, now: Date): Promise<void>;
  /** `nextAttemptAt: null` means give up (`dead`). */
  markFailed(id: string, failure: { error: string; nextAttemptAt: Date | null }): Promise<void>;
  get(id: string): Promise<OutboxItem | null>;
}

export interface SentEmailReceipt {
  messageId: string;
}

export interface EmailAdapter {
  send(message: EmailMessage): Promise<SentEmailReceipt>;
}

export class EmailDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}
