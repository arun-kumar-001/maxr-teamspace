import type { Pool } from 'pg';
import { getFieldCipher } from '../security/field-cipher';
import type { FieldCipher } from '../security/field-crypto';
import { closePool, getPool } from './client';

/** Every column that holds an identity or bank number. Names are fixed here, never from input. */
export const ENCRYPTED_COLUMNS = [
  { table: 'employees', column: 'pan_number' },
  { table: 'employees', column: 'aadhaar_number' },
  { table: 'employees', column: 'bank_account_number' },
  { table: 'payslips', column: 'pan' },
  { table: 'payslips', column: 'account_number' },
] as const;

const BATCH = 500;

export type EncryptFieldsResult = Record<string, number>;

/**
 * Encrypts values written before encryption existed. Safe to run again and while the API is up:
 * only rows still holding plain text are touched, each batch under its own row locks, and the API
 * reads both forms meanwhile.
 */
export async function encryptSensitiveFields(
  pool: Pool,
  cipher: FieldCipher,
): Promise<EncryptFieldsResult> {
  const result: EncryptFieldsResult = {};
  for (const { table, column } of ENCRYPTED_COLUMNS) {
    const context = `${table}.${column}`;
    let done = 0;
    for (;;) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const rows = await client.query<{ id: string; value: string }>(
          `SELECT id, ${column} AS value FROM ${table}
            WHERE ${column} IS NOT NULL AND ${column} <> '' AND ${column} NOT LIKE 'enc:v1:%'
            ORDER BY id LIMIT ${BATCH} FOR UPDATE`,
        );
        for (const row of rows.rows) {
          await client.query(`UPDATE ${table} SET ${column} = $2 WHERE id = $1`, [
            row.id,
            cipher.encrypt(row.value, context),
          ]);
        }
        await client.query('COMMIT');
        done += rows.rows.length;
        if (rows.rows.length < BATCH) break;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw err;
      } finally {
        client.release();
      }
    }
    result[context] = done;
  }
  return result;
}

if (require.main === module) {
  encryptSensitiveFields(getPool(), getFieldCipher())
    .then((result) => {
      // eslint-disable-next-line no-console
      console.info('[EncryptFields] Encrypted rows:', result);
      return closePool();
    })
    .catch(async (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[EncryptFields Failed]', err instanceof Error ? err.message : String(err));
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}
