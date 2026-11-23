import { describe, expect, it } from 'vitest';
import { SessionService, hashToken } from './session-service';
import { describeSessionStoreContract } from './contracts/session-store.contract';
import { InMemorySessionStore } from './session-store';

const MIN = 60_000;
const config = { sessionIdleMs: 30 * MIN, sessionMaxAgeMs: 8 * 60 * MIN };

function setup() {
  const clock = { t: 1_000_000 };
  const store = new InMemorySessionStore(() => clock.t);
  const service = new SessionService(store, config, () => clock.t);
  return { clock, store, service };
}

describeSessionStoreContract('in memory', async () => new InMemorySessionStore());

describe('in-memory store expiry', () => {
  it('forgets a session after its time to live, and touch moves it', async () => {
    const clock = { t: 0 };
    const store = new InMemorySessionStore(() => clock.t);
    await store.create('h', { userId: 'u', csrfToken: 'c', createdAt: 0 }, 1000);
    clock.t = 900;
    await store.touch('h', 1000);
    clock.t = 1800;
    expect(await store.get('h')).not.toBeNull();
    clock.t = 1901;
    expect(await store.get('h')).toBeNull();
  });
});

describe('SessionService', () => {
  it('issues unguessable tokens and stores only their hash', async () => {
    const { service, store } = setup();
    const a = await service.create('user-1');
    const b = await service.create('user-1');
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.csrfToken).not.toBe(a.token);
    expect(await store.get(a.token)).toBeNull(); // the raw token is not a key
    expect(await store.get(hashToken(a.token))).toMatchObject({ userId: 'user-1' });
  });

  it('resolves a live session and rejects malformed tokens without touching the store', async () => {
    const { service } = setup();
    const { token, csrfToken } = await service.create('user-1');
    expect(await service.resolve(token)).toMatchObject({ userId: 'user-1', csrfToken });
    for (const bad of ['', 'short', 'x'.repeat(43) + '!', 'a'.repeat(200), '../../etc/passwd']) {
      expect(await service.resolve(bad)).toBeNull();
    }
  });

  it('ends a session after the idle time and renews it while it is used', async () => {
    const { service, clock } = setup();
    const { token } = await service.create('user-1');
    clock.t += 29 * MIN;
    expect(await service.resolve(token)).not.toBeNull(); // renews
    clock.t += 29 * MIN;
    expect(await service.resolve(token)).not.toBeNull(); // renewed again
    clock.t += 31 * MIN;
    expect(await service.resolve(token)).toBeNull(); // idle too long
  });

  it('never lives past the absolute limit, however active', async () => {
    const { service, clock } = setup();
    const { token } = await service.create('user-1');
    for (let elapsed = 0; elapsed < 8 * 60 - 20; elapsed += 20) {
      clock.t += 20 * MIN;
      expect(await service.resolve(token)).not.toBeNull();
    }
    clock.t += 21 * MIN; // past 8 hours in total
    expect(await service.resolve(token)).toBeNull();
  });

  it('revokeAllForUser keeps only the excepted session', async () => {
    const { service } = setup();
    const keep = await service.create('user-1');
    const other = await service.create('user-1');
    const resolved = await service.resolve(keep.token);
    expect(await service.revokeAllForUser('user-1', resolved?.tokenHash)).toBe(1);
    expect(await service.resolve(other.token)).toBeNull();
    expect(await service.resolve(keep.token)).not.toBeNull();
  });
});
