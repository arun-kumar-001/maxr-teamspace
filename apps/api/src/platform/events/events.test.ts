import { describe, expect, it, vi } from 'vitest';
import { captureLogger } from '../../test/helpers';
import { DomainEvent, EventCollector, InProcessEventBus } from './event-bus';

const event = (type: string, payload: unknown = {}): DomainEvent => ({
  type,
  payload,
  actorId: 'u-1',
  requestId: 'r-1',
});

describe('event bus (TC-13-08 .. TC-13-10)', () => {
  it('TC-13-08 calls every subscriber of that event type, and only those', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    const approved = vi.fn();
    const other = vi.fn();
    bus.subscribe('leave.approved', approved);
    bus.subscribe('leave.rejected', other);
    await bus.emit(event('leave.approved', { id: 1 }));
    expect(approved).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'leave.approved', payload: { id: 1 } }),
    );
    expect(other).not.toHaveBeenCalled();
  });

  it('TC-13-08 an event nobody listens to is fine', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    await expect(bus.emit(event('nobody.listens'))).resolves.toBeUndefined();
  });

  it('TC-13-09 a failing subscriber never breaks the caller or the other subscribers, and is logged without the payload', async () => {
    const log = captureLogger();
    const bus = new InProcessEventBus(log.logger);
    const second = vi.fn();
    bus.subscribe('leave.approved', async () => {
      throw new Error('email server down');
    });
    bus.subscribe('leave.approved', second);
    await expect(bus.emit(event('leave.approved', { ssnLike: '123-45' }))).resolves.toBeUndefined();
    expect(second).toHaveBeenCalledOnce();
    const text = log.lines.join('\n');
    expect(text).toContain('event handler failed');
    expect(text).toContain('leave.approved');
    expect(text).not.toContain('123-45');
  });

  it('TC-13-10 subscribe returns an unsubscribe function', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    const handler = vi.fn();
    const off = bus.subscribe('a.b', handler);
    await bus.emit(event('a.b'));
    off();
    await bus.emit(event('a.b'));
    expect(handler).toHaveBeenCalledOnce();
  });

  it.each(['noprefix', 'Upper.Case', 'has space.x', ''])(
    'rejects the event type %j',
    async (type) => {
      const bus = new InProcessEventBus(captureLogger().logger);
      expect(() => bus.subscribe(type, () => undefined)).toThrow();
      await expect(bus.emit(event(type))).rejects.toThrow();
    },
  );
});

describe('event collector: announce only after commit (TC-13-09)', () => {
  it('emits nothing until flush, then everything in the order it was added', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    const seen: string[] = [];
    bus.subscribe('a.first', () => void seen.push('first'));
    bus.subscribe('a.second', async () => {
      await Promise.resolve();
      seen.push('second');
    });
    const collector = new EventCollector();
    collector.add(event('a.first'));
    collector.add(event('a.second'));
    expect(seen).toEqual([]); // transaction still open
    expect(collector.size).toBe(2);
    expect(await collector.flush(bus)).toBe(2);
    expect(seen).toEqual(['first', 'second']);
    expect(collector.size).toBe(0);
  });

  it('emits nothing after a rollback (discard)', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    const handler = vi.fn();
    bus.subscribe('a.first', handler);
    const collector = new EventCollector();
    collector.add(event('a.first'));
    collector.discard();
    expect(await collector.flush(bus)).toBe(0);
    expect(handler).not.toHaveBeenCalled();
  });

  it('flushing twice never emits an event twice', async () => {
    const bus = new InProcessEventBus(captureLogger().logger);
    const handler = vi.fn();
    bus.subscribe('a.first', handler);
    const collector = new EventCollector();
    collector.add(event('a.first'));
    await collector.flush(bus);
    await collector.flush(bus);
    expect(handler).toHaveBeenCalledOnce();
  });
});
