import { Logger } from '../../logging/logger';
import { scrubText } from '../../logging/redact';
import { retryDelayMs } from './backoff';
import { EmailAdapter, NotificationOutbox } from './types';

export interface DispatchSummary {
  claimed: number;
  sent: number;
  retried: number;
  dead: number;
}

export interface OutboxDispatcher {
  /** Sends everything that is due once. Safe to call from several workers at the same time. */
  runOnce(now?: Date): Promise<DispatchSummary>;
  start(intervalMs: number): void;
  stop(): void;
}

export interface OutboxDispatcherOptions {
  outbox: NotificationOutbox;
  email: EmailAdapter;
  logger: Logger;
  maxAttempts: number;
  batchSize?: number;
  /** How long a claimed item stays reserved for this worker. */
  lockMs?: number;
}

const MAX_ERROR_LENGTH = 300;

function describeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  return scrubText(raw).slice(0, MAX_ERROR_LENGTH);
}

export function createOutboxDispatcher({
  outbox,
  email,
  logger,
  maxAttempts,
  batchSize = 20,
  lockMs = 60_000,
}: OutboxDispatcherOptions): OutboxDispatcher {
  let timer: NodeJS.Timeout | null = null;
  let running = false;

  const runOnce = async (now: Date = new Date()): Promise<DispatchSummary> => {
    const summary: DispatchSummary = { claimed: 0, sent: 0, retried: 0, dead: 0 };
    const items = await outbox.claimDue(batchSize, now, lockMs);
    summary.claimed = items.length;

    for (const item of items) {
      try {
        await email.send(item.payload);
        await outbox.markSent(item.id, new Date());
        summary.sent += 1;
        logger.info('notification sent', { outboxId: item.id, attempt: item.attempts });
      } catch (err) {
        const giveUp = item.attempts >= maxAttempts;
        const nextAttemptAt = giveUp ? null : new Date(now.getTime() + retryDelayMs(item.attempts));
        await outbox.markFailed(item.id, { error: describeError(err), nextAttemptAt });
        if (giveUp) {
          summary.dead += 1;
        } else {
          summary.retried += 1;
        }
        logger.warn('notification failed', {
          outboxId: item.id,
          attempt: item.attempts,
          willRetry: !giveUp,
          nextAttemptAt: nextAttemptAt?.toISOString(),
        });
      }
    }
    return summary;
  };

  return {
    runOnce,
    start(intervalMs) {
      if (timer) {
        return;
      }
      timer = setInterval(() => {
        if (running) {
          return; // the previous run is still busy
        }
        running = true;
        runOnce()
          .catch((err) => logger.error('outbox dispatcher run failed', { err }))
          .finally(() => {
            running = false;
          });
      }, intervalMs);
      timer.unref();
    },
    stop() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    },
  };
}
