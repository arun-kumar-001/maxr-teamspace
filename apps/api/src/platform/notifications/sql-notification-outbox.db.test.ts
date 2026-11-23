import { afterAll, beforeEach, describe } from 'vitest';
import { getPool, closePool } from '../../db/client';
import { describeOutboxContract } from '../contracts/outbox.contract';
import { SqlNotificationOutbox } from './sql-notification-outbox';

describe('SqlNotificationOutbox', () => {
  const pool = getPool();
  const outbox = new SqlNotificationOutbox(pool);

  beforeEach(async () => {
    // Clear outbox table before each contract test so tests start with a clean queue
    await pool.query('DELETE FROM notification_outbox');
  });

  afterAll(async () => {
    await closePool();
  });

  // Executes the exact official platform contract suite against real PostgreSQL
  describeOutboxContract('PostgreSQL durable outbox', async () => outbox);
});
