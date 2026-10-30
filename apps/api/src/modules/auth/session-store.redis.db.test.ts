import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { closeRedis, getRedisClient } from '../../db/redis';
import { describeSessionStoreContract } from './contracts/session-store.contract';
import { RedisSessionStore } from './session-store';

const redis = getRedisClient();
const store = new RedisSessionStore(() => redis, 60_000);

async function clear() {
  const keys = [...(await redis.keys('maxr:sess:*')), ...(await redis.keys('maxr:user-sess:*'))];
  if (keys.length > 0) await redis.del(...keys);
}

beforeEach(clear);
afterAll(async () => {
  await clear();
  await closeRedis();
});

describeSessionStoreContract('Redis', async () => store);

describe('RedisSessionStore specifics', () => {
  const record = { userId: 'user-1', csrfToken: 'csrf', createdAt: 1 };

  it('expires sessions by itself and touch moves the expiry', async () => {
    await store.create('short', record, 150);
    await new Promise((r) => setTimeout(r, 250));
    expect(await store.get('short')).toBeNull();

    await store.create('renewed', record, 150);
    await new Promise((r) => setTimeout(r, 100));
    await store.touch('renewed', 1000);
    await new Promise((r) => setTimeout(r, 150));
    expect(await store.get('renewed')).toEqual(record);
  });

  it('stores only a hash, with a time to live', async () => {
    await store.create('abc123', record, 60_000);
    const ttl = await redis.pttl('maxr:sess:abc123');
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(60_000);
  });

  it('treats a corrupt entry as no session', async () => {
    await redis.set('maxr:sess:broken', '{not json');
    expect(await store.get('broken')).toBeNull();
    await redis.set('maxr:sess:wrong-shape', JSON.stringify({ userId: 5 }));
    expect(await store.get('wrong-shape')).toBeNull();
  });
});
