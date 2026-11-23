import { Logger } from '../../logging/logger';
import { AuditEntry, AuditStore, AuditWriteOptions } from './types';

/** Writes each entry as one structured log line flagged `audit: true`. Not a durable audit trail by itself. */
export class LoggerAuditStore implements AuditStore {
  constructor(private readonly logger: Logger) {}

  async append(entry: AuditEntry): Promise<void> {
    this.logger.info('audit', { audit: true, ...entry });
  }
}

/** Keeps entries in memory. For tests and local development only. */
export class InMemoryAuditStore implements AuditStore {
  private readonly entries: AuditEntry[] = [];
  private nextFailure: Error | null = null;
  /** Test helper: the `transaction` option received with each entry, in order. */
  readonly transactions: unknown[] = [];

  async append(entry: AuditEntry, options?: AuditWriteOptions): Promise<void> {
    if (this.nextFailure) {
      const error = this.nextFailure;
      this.nextFailure = null;
      throw error;
    }
    this.entries.push(entry);
    this.transactions.push(options?.transaction);
  }

  list(): readonly AuditEntry[] {
    return this.entries;
  }

  find(predicate: (entry: AuditEntry) => boolean): AuditEntry[] {
    return this.entries.filter(predicate);
  }

  /** Test helper: the next append fails with this error. */
  failNextWith(error: Error): void {
    this.nextFailure = error;
  }
}
