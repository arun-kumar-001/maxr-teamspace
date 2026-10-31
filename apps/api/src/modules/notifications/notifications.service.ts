import { randomUUID } from 'node:crypto';
import { PaginatedResponse } from '@maxr/shared';
import { notFound } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { Logger } from '../../logging/logger';
import type { PlatformServices } from '../../platform';
import type { DomainEvent, EventBus } from '../../platform/events/event-bus';
import { INotificationsRepository } from './notifications.repository';
import type { AnnounceInput, ListNotificationsQuery } from './notifications.schemas';
import { AppNotification, Recipient } from './notifications.types';
import { TemplateType, renderEmail, renderNotification } from './templates';

type Deps = Pick<PlatformServices, 'audit' | 'notifications'>;

const HOUR_MS = 60 * 60 * 1000;
/** A step waiting longer than this gets a reminder (D-15). */
export const REMINDER_AFTER_HOURS = 24;
/** Read notifications are kept this long (D-15). */
export const RETENTION_DAYS = 90;

export interface NotificationCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

type Stage = 'manager' | 'hr';

interface TaskEventPayload {
  taskId: string;
  assigneeEmployeeId: string;
  assignerEmployeeId: string;
}

interface ApprovalEventPayload {
  approvalId: string;
  subjectType: string;
  requesterEmployeeId: string;
  stage?: Stage;
}

export class NotificationsService {
  constructor(
    private readonly repository: INotificationsRepository,
    private readonly platform: Deps,
    private readonly logger: Logger,
    private readonly appUrl?: string,
  ) {}

  /**
   * Listens for the events that mean someone has something to do or to know. Events arrive after
   * the commit that caused them, so nothing is sent for work that was rolled back. A failure is
   * logged by the bus and never reaches the code that raised the event.
   */
  subscribe(bus: EventBus): void {
    const onRequested = (type: TemplateType) => (event: DomainEvent) =>
      this.onApprovalStep(event, type);
    bus.subscribe('approvals.requested', onRequested('approval.requested'));
    bus.subscribe('approvals.advanced', onRequested('approval.advanced'));
    bus.subscribe('approvals.approved', (event) =>
      this.onApprovalDecided(event, 'approval.approved'),
    );
    bus.subscribe('approvals.rejected', (event) =>
      this.onApprovalDecided(event, 'approval.rejected'),
    );
    bus.subscribe('leave.cancelled', (event) => this.onLeaveCancelled(event));
    bus.subscribe('tasks.assigned', (event) => this.onTaskAssigned(event));
    bus.subscribe('tasks.status_changed', (event) => this.onTaskStatusChanged(event));
    bus.subscribe('tasks.commented', (event) => this.onTaskCommented(event));
  }

  private async onApprovalStep(event: DomainEvent, type: TemplateType): Promise<void> {
    const p = event.payload as ApprovalEventPayload;
    for (const recipient of await this.approversFor(p.stage, p.requesterEmployeeId)) {
      await this.notify(recipient, type, {
        subjectType: p.subjectType,
        link: `/approvals/${p.approvalId}`,
        dedupeKey: `${type}:${p.approvalId}:${p.stage}`,
      });
    }
  }

  private async onApprovalDecided(event: DomainEvent, type: TemplateType): Promise<void> {
    const p = event.payload as ApprovalEventPayload;
    const recipient = await this.repository.findRecipient(p.requesterEmployeeId);
    if (!recipient) return;
    await this.notify(recipient, type, {
      subjectType: p.subjectType,
      link: `/approvals/${p.approvalId}`,
      dedupeKey: `${type}:${p.approvalId}`,
    });
  }

  private async onLeaveCancelled(event: DomainEvent): Promise<void> {
    const p = event.payload as { leaveRequestId: string; employeeId: string; byOwner: boolean };
    // Cancelling your own leave needs no message to yourself.
    if (p.byOwner) return;
    const recipient = await this.repository.findRecipient(p.employeeId);
    if (!recipient) return;
    await this.notify(recipient, 'leave.cancelled', {
      link: '/leave',
      dedupeKey: `leave.cancelled:${p.leaveRequestId}`,
    });
  }

  private async onTaskAssigned(event: DomainEvent): Promise<void> {
    const p = event.payload as TaskEventPayload;
    // Giving yourself a task needs no message.
    if (p.assigneeEmployeeId === p.assignerEmployeeId) return;
    await this.notifyEmployee(p.assigneeEmployeeId, 'task.assigned', {
      link: `/tasks/${p.taskId}`,
      dedupeKey: `task.assigned:${p.taskId}:${event.requestId ?? randomUUID()}`,
    });
  }

  /**
   * Review and blockage go to the person who assigned the task; completion and reopening go to
   * its assignee. Nobody is told about a move they made themselves.
   */
  private async onTaskStatusChanged(event: DomainEvent): Promise<void> {
    const p = event.payload as TaskEventPayload & {
      from: string;
      to: string;
      byEmployeeId: string;
    };
    const toAssigner: Record<string, TemplateType> = {
      in_review: 'task.in_review',
      blocked: 'task.blocked',
    };
    let type: TemplateType | undefined;
    let recipientId: string | undefined;
    if (toAssigner[p.to]) {
      type = toAssigner[p.to];
      recipientId = p.assignerEmployeeId;
    } else if (p.to === 'completed') {
      type = 'task.completed';
      recipientId = p.assigneeEmployeeId;
    } else if (p.from === 'completed') {
      type = 'task.reopened';
      recipientId = p.assigneeEmployeeId;
    }
    if (!type || !recipientId || recipientId === p.byEmployeeId) return;
    await this.notifyEmployee(recipientId, type, {
      link: `/tasks/${p.taskId}`,
      dedupeKey: `${type}:${p.taskId}:${event.requestId ?? randomUUID()}`,
    });
  }

  /** The assignee and the assigner hear of a comment, except the person who wrote it. The text is not sent. */
  private async onTaskCommented(event: DomainEvent): Promise<void> {
    const p = event.payload as TaskEventPayload & { authorEmployeeId: string };
    const recipients = new Set([p.assigneeEmployeeId, p.assignerEmployeeId]);
    recipients.delete(p.authorEmployeeId);
    for (const employeeId of recipients) {
      await this.notifyEmployee(employeeId, 'task.commented', {
        link: `/tasks/${p.taskId}`,
        dedupeKey: `task.commented:${p.taskId}:${event.requestId ?? randomUUID()}`,
      });
    }
  }

  private async notifyEmployee(
    employeeId: string,
    type: TemplateType,
    options: { link: string; dedupeKey: string },
  ): Promise<void> {
    const recipient = await this.repository.findRecipient(employeeId);
    if (recipient) await this.notify(recipient, type, options);
  }

  /** Who decides the step: the requester's manager, or the HR Managers and Admins (never the requester). */
  private async approversFor(
    stage: Stage | undefined,
    requesterEmployeeId: string,
  ): Promise<Recipient[]> {
    if (stage === 'manager') {
      const manager = await this.repository.findManagerOf(requesterEmployeeId);
      return manager ? [manager] : [];
    }
    if (stage === 'hr') return this.repository.findHrApprovers(requesterEmployeeId);
    return [];
  }

  /**
   * Stores the in-app notification and queues the email. The same dedupe key for the same
   * recipient does both once: a repeated event or reminder run sends nothing new.
   */
  private async notify(
    recipient: Recipient,
    type: TemplateType,
    options: { subjectType?: string; link: string; dedupeKey: string },
  ): Promise<boolean> {
    const rendered = renderNotification(type, { subjectType: options.subjectType });
    const created = await this.repository.insert({
      recipientEmployeeId: recipient.employeeId,
      type,
      title: rendered.title,
      body: rendered.body,
      link: options.link,
      dedupeKey: options.dedupeKey,
    });
    if (!created) return false;
    const email = renderEmail(rendered, this.appUrl, options.link);
    try {
      await this.platform.notifications.enqueueEmail({
        to: [recipient.email],
        subject: email.subject,
        text: email.text,
        dedupeKey: `notification:${recipient.employeeId}:${options.dedupeKey}`,
      });
    } catch (err) {
      // The in-app notification stands; the outbox is what retries a send, not this call.
      this.logger.error('notification email could not be queued', {
        notificationId: created.id,
        err,
      });
    }
    return true;
  }

  async list(
    query: ListNotificationsQuery,
    caller: NotificationCaller,
  ): Promise<PaginatedResponse<AppNotification> & { meta: { unread: number } }> {
    const { items, total, unread } = await this.repository.list(caller.employeeId, {
      unreadOnly: query.unread ?? false,
      ...toOffsetLimit(query),
    });
    const page = buildPage(items, total, query);
    return { ...page, meta: { ...page.meta, unread } };
  }

  async markRead(id: string, caller: NotificationCaller): Promise<AppNotification> {
    const found = await this.repository.markRead(id, caller.employeeId);
    // Someone else's notification looks exactly like a missing one.
    if (!found) throw notFound('Notification not found');
    return found;
  }

  async markAllRead(caller: NotificationCaller): Promise<{ updated: number }> {
    return { updated: await this.repository.markAllRead(caller.employeeId) };
  }

  /** An in-app announcement to every active employee (D-15: announcements are not e-mailed). */
  async announce(
    input: AnnounceInput,
    caller: NotificationCaller,
  ): Promise<{ recipients: number }> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const recipients = await this.repository.announce(tx, input.title, input.message);
      await audit.record(
        {
          action: 'notification.announce',
          outcome: 'success',
          entityType: 'announcement',
          metadata: { recipients },
        },
        { transaction: tx },
      );
      return { recipients };
    });
  }

  /** Reminds the approvers of every step that has waited more than a day, once per approval and step. Returns how many reminders it created. */
  async sendApprovalReminders(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - REMINDER_AFTER_HOURS * HOUR_MS);
    let sent = 0;
    for (const stale of await this.repository.findStaleApprovals(cutoff)) {
      for (const recipient of await this.approversFor(stale.stage, stale.requesterEmployeeId)) {
        const created = await this.notify(recipient, 'approval.reminder', {
          subjectType: stale.subjectType,
          link: `/approvals/${stale.approvalId}`,
          dedupeKey: `approval.reminder:${stale.approvalId}:${stale.stage}`,
        });
        if (created) sent += 1;
      }
    }
    return sent;
  }

  /**
   * Reminds the assignee of an open task that is due by tomorrow (D-15), once per task and due
   * date. A task given a new due date is reminded about again. Returns how many reminders it created.
   */
  async sendTaskDueReminders(now: Date): Promise<number> {
    let sent = 0;
    for (const due of await this.repository.findTasksDueSoon(now)) {
      const recipient = await this.repository.findRecipient(due.assigneeEmployeeId);
      if (!recipient) continue;
      const created = await this.notify(recipient, 'task.due', {
        link: `/tasks/${due.taskId}`,
        dedupeKey: `task.due:${due.taskId}:${due.dueDate}`,
      });
      if (created) sent += 1;
    }
    return sent;
  }

  /** Removes notifications that were read more than 90 days ago. */
  purgeRead(now: Date): Promise<number> {
    return this.repository.deleteReadBefore(
      new Date(now.getTime() - RETENTION_DAYS * 24 * HOUR_MS),
    );
  }
}
