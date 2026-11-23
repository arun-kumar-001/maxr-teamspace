import { z } from 'zod';
import { Logger } from '../../logging/logger';

export interface DomainEvent<T = unknown> {
  /** `module.past_tense_verb`, lower case: `leave.approved`, `employee.created`. */
  type: string;
  payload: T;
  actorId?: string;
  requestId?: string;
}

export type EventHandler = (event: DomainEvent) => void | Promise<void>;

export interface EventBus {
  /** Calls every subscriber. A failing subscriber is logged and never breaks the caller or the others. */
  emit(event: DomainEvent): Promise<void>;
  /** Returns a function that removes the subscription. */
  subscribe(type: string, handler: EventHandler): () => void;
}

const typeSchema = z
  .string()
  .max(100)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, 'must look like module.event');

export class InProcessEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  constructor(private readonly logger: Logger) {}

  subscribe(type: string, handler: EventHandler): () => void {
    typeSchema.parse(type);
    const set = this.handlers.get(type) ?? new Set<EventHandler>();
    set.add(handler);
    this.handlers.set(type, set);
    return () => {
      set.delete(handler);
    };
  }

  async emit(event: DomainEvent): Promise<void> {
    typeSchema.parse(event.type);
    const subscribers = [...(this.handlers.get(event.type) ?? [])];
    const results = await Promise.allSettled(subscribers.map(async (handler) => handler(event)));
    for (const result of results) {
      if (result.status === 'rejected') {
        // The payload is not logged: it may hold personal data.
        this.logger.error('event handler failed', {
          eventType: event.type,
          requestId: event.requestId,
          err: result.reason,
        });
      }
    }
  }
}

/**
 * Holds events while a database transaction is open so nothing is announced for work that is
 * rolled back:  `collector.add(...)`  ->  commit  ->  `await collector.flush(bus)`.
 * After a rollback call `discard()` (or simply never flush).
 */
export class EventCollector {
  private events: DomainEvent[] = [];

  add(event: DomainEvent): void {
    this.events.push(event);
  }

  get size(): number {
    return this.events.length;
  }

  /** Emits in the order added, one after another. Returns how many were emitted. */
  async flush(bus: EventBus): Promise<number> {
    const pending = this.events;
    this.events = [];
    for (const event of pending) {
      await bus.emit(event);
    }
    return pending.length;
  }

  discard(): void {
    this.events = [];
  }
}
