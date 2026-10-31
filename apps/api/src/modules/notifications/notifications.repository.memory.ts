import { randomUUID } from 'node:crypto';
import { INotificationsRepository } from './notifications.repository';
import {
  AppNotification,
  NewNotification,
  NotificationTx,
  Recipient,
  StaleApproval,
} from './notifications.types';

interface Stored extends AppNotification {
  recipientEmployeeId: string;
  dedupeKey: string | null;
}

export interface MemoryEmployee {
  email: string;
  managerId: string | null;
  isHrApprover: boolean;
  active: boolean;
}

/** In-memory notifications for unit and HTTP tests (not shipped in the build). */
export class MemoryNotificationsRepository implements INotificationsRepository {
  rows: Stored[] = [];
  employees: Record<string, MemoryEmployee> = {};
  stale: StaleApproval[] = [];
  /** The cutoffs the service asked for, so a test can check the thresholds. */
  staleCutoffs: Date[] = [];
  now: () => Date = () => new Date();

  async transaction<T>(work: (tx: NotificationTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.rows);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as NotificationTx);
    } catch (err) {
      this.rows = snapshot;
      throw err;
    }
  }

  private strip(row: Stored): AppNotification {
    const { recipientEmployeeId: _r, dedupeKey: _d, ...visible } = row;
    return visible;
  }

  async insert(input: NewNotification): Promise<AppNotification | null> {
    if (
      input.dedupeKey &&
      this.rows.some(
        (r) =>
          r.recipientEmployeeId === input.recipientEmployeeId && r.dedupeKey === input.dedupeKey,
      )
    ) {
      return null;
    }
    const row: Stored = {
      id: randomUUID(),
      recipientEmployeeId: input.recipientEmployeeId,
      dedupeKey: input.dedupeKey,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      readAt: null,
      createdAt: this.now().toISOString(),
    };
    this.rows.push(row);
    return this.strip(row);
  }

  async list(employeeId: string, options: { unreadOnly: boolean; offset: number; limit: number }) {
    const own = this.rows.filter((r) => r.recipientEmployeeId === employeeId);
    const shown = own
      .filter((r) => !options.unreadOnly || r.readAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      items: shown.slice(options.offset, options.offset + options.limit).map((r) => this.strip(r)),
      total: shown.length,
      unread: own.filter((r) => r.readAt === null).length,
    };
  }

  async markRead(id: string, employeeId: string): Promise<AppNotification | null> {
    const row = this.rows.find((r) => r.id === id && r.recipientEmployeeId === employeeId);
    if (!row) return null;
    row.readAt ??= this.now().toISOString();
    return this.strip(row);
  }

  async markAllRead(employeeId: string): Promise<number> {
    const unread = this.rows.filter((r) => r.recipientEmployeeId === employeeId && !r.readAt);
    for (const row of unread) row.readAt = this.now().toISOString();
    return unread.length;
  }

  async announce(_tx: NotificationTx, title: string, body: string): Promise<number> {
    const active = Object.entries(this.employees).filter(([, e]) => e.active);
    for (const [id] of active) {
      await this.insert({
        recipientEmployeeId: id,
        type: 'announcement',
        title,
        body,
        link: null,
        dedupeKey: null,
      });
    }
    return active.length;
  }

  async deleteReadBefore(cutoff: Date): Promise<number> {
    const before = this.rows.length;
    this.rows = this.rows.filter((r) => !r.readAt || new Date(r.readAt) >= cutoff);
    return before - this.rows.length;
  }

  private recipient(id: string): Recipient | null {
    const employee = this.employees[id];
    return employee?.active ? { employeeId: id, email: employee.email } : null;
  }

  async findRecipient(employeeId: string): Promise<Recipient | null> {
    return this.recipient(employeeId);
  }

  async findManagerOf(employeeId: string): Promise<Recipient | null> {
    const managerId = this.employees[employeeId]?.managerId;
    return managerId ? this.recipient(managerId) : null;
  }

  async findHrApprovers(excludeEmployeeId: string): Promise<Recipient[]> {
    return Object.entries(this.employees)
      .filter(([id, e]) => e.isHrApprover && e.active && id !== excludeEmployeeId)
      .map(([id, e]) => ({ employeeId: id, email: e.email }));
  }

  async findStaleApprovals(cutoff: Date): Promise<StaleApproval[]> {
    this.staleCutoffs.push(cutoff);
    return this.stale;
  }
}
