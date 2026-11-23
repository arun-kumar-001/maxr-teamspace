import { randomUUID } from 'crypto';
import { Logger } from '../../logging/logger';
import { validateEmailMessage } from './email-validation';
import { EmailMessage, NotificationOutbox, OutboxItem } from './types';

export interface EnqueueEmailInput extends EmailMessage {
  /** Same key = same message: retrying the caller never sends twice. Example: `leave:123:approved`. */
  dedupeKey?: string;
}

export interface NotificationService {
  /**
   * Validates and queues an email. Call it AFTER the database transaction has committed
   * (for example from an event handler) so nothing is sent for work that was rolled back.
   */
  enqueueEmail(input: EnqueueEmailInput): Promise<OutboxItem>;
}

export interface NotificationServiceOptions {
  outbox: NotificationOutbox;
  logger: Logger;
  now?: () => Date;
  newId?: () => string;
}

export function createNotificationService({
  outbox,
  logger,
  now = () => new Date(),
  newId = randomUUID,
}: NotificationServiceOptions): NotificationService {
  return {
    async enqueueEmail({ dedupeKey, ...message }) {
      const payload = validateEmailMessage(message);
      const item = await outbox.enqueue({
        id: newId(),
        channel: 'email',
        payload,
        dedupeKey,
        now: now(),
      });
      // Only ids: recipients, subjects and bodies are personal data and never logged.
      logger.info('notification queued', {
        outboxId: item.id,
        channel: item.channel,
        recipients: payload.to.length,
      });
      return item;
    },
  };
}
