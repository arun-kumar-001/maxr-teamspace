import type { Pool, PoolClient } from 'pg';

export type NotificationTx = Pick<PoolClient, 'query'>;
export type PoolGetter = () => Pool;

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  /** A path inside the web app, starting with `/`. */
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NewNotification {
  recipientEmployeeId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  /** The same key twice for one recipient creates one notification. */
  dedupeKey: string | null;
}

export interface Recipient {
  employeeId: string;
  email: string;
}

/** An approval that has waited longer than the reminder threshold at its current step. */
export interface StaleApproval {
  approvalId: string;
  subjectType: string;
  requesterEmployeeId: string;
  stage: 'manager' | 'hr';
}
