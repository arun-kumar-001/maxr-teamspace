export type AuditOutcome = 'success' | 'denied' | 'failure';

/** What a module supplies. Everything is optional except what happened and to what. */
export interface AuditEventInput {
  /** `module.verb`, lower case: `employee.deactivate`, `leave.approve`, `auth.login_failed`. */
  action: string;
  outcome: AuditOutcome;
  entityType: string;
  entityId?: string;
  actorId?: string;
  actorRole?: string;
  requestId?: string;
  /** Field-level changes, e.g. `{ status: { from: 'pending', to: 'approved' } }`. Redacted and size-capped. */
  changes?: Record<string, unknown>;
  /** Extra context. Redacted and size-capped. Never put personal data here. */
  metadata?: Record<string, unknown>;
}

export interface AuditEntry extends AuditEventInput {
  id: string;
  /** UTC ISO timestamp. */
  occurredAt: string;
}

/**
 * Optional write settings. `transaction` is the open database transaction (for example a pg
 * client): a SQL store must write the entry inside it, so the audit entry and the data change
 * commit or roll back together. Typed `unknown` here so this layer does not depend on pg.
 */
export interface AuditWriteOptions {
  transaction?: unknown;
}

/** Where entries go. Append only: there is deliberately no update or delete. */
export interface AuditStore {
  append(entry: AuditEntry, options?: AuditWriteOptions): Promise<void>;
}

export interface AuditContext {
  actorId?: string;
  actorRole?: string;
  requestId?: string;
}

export interface AuditLogger {
  /** Fails closed: throws `AuditError` if the entry is invalid or the store fails. */
  record(event: AuditEventInput, options?: AuditWriteOptions): Promise<AuditEntry>;
  /** For non-critical events: never throws, logs the failure and returns null. */
  tryRecord(event: AuditEventInput, options?: AuditWriteOptions): Promise<AuditEntry | null>;
  /** A logger that fills in the actor and request id for every entry. */
  withContext(context: AuditContext): AuditLogger;
}

export class AuditError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuditError';
  }
}
