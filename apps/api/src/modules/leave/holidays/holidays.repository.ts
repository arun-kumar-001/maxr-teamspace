import type { PoolClient } from 'pg';
import { conflict } from '../../../http/errors';
import type { LeaveTx, PoolGetter } from '../policies/policies.types';
import { Holiday } from './holidays.types';

export interface IHolidaysRepository {
  transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T>;
  listYear(year: number): Promise<Holiday[]>;
  datesBetween(from: string, to: string): Promise<string[]>;
  /** A 409 when the date already has a holiday. */
  insert(tx: LeaveTx, date: string, name: string): Promise<Holiday>;
  /** Locks and returns the holiday, or null. */
  findForUpdate(tx: LeaveTx, id: string): Promise<Holiday | null>;
  remove(tx: LeaveTx, id: string): Promise<void>;
}

interface Row {
  id: string;
  holiday_date: string;
  name: string;
}

// DATE columns are read as text so the driver does not turn them into local-midnight Dates.
const COLUMNS = `id, holiday_date::text AS holiday_date, name`;
const toHoliday = (row: Row): Holiday => ({ id: row.id, date: row.holiday_date, name: row.name });

export class PgHolidaysRepository implements IHolidaysRepository {
  constructor(private readonly getPool: PoolGetter) {}

  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async listYear(year: number): Promise<Holiday[]> {
    const res = await this.getPool().query<Row>(
      `SELECT ${COLUMNS} FROM holidays
        WHERE holiday_date >= make_date($1, 1, 1) AND holiday_date <= make_date($1, 12, 31)
        ORDER BY holiday_date`,
      [year],
    );
    return res.rows.map(toHoliday);
  }

  async datesBetween(from: string, to: string): Promise<string[]> {
    const res = await this.getPool().query<{ holiday_date: string }>(
      `SELECT holiday_date::text AS holiday_date FROM holidays
        WHERE holiday_date BETWEEN $1::date AND $2::date ORDER BY holiday_date`,
      [from, to],
    );
    return res.rows.map((row) => row.holiday_date);
  }

  async insert(tx: LeaveTx, date: string, name: string): Promise<Holiday> {
    try {
      const res = await tx.query<Row>(
        `INSERT INTO holidays (holiday_date, name) VALUES ($1, $2) RETURNING ${COLUMNS}`,
        [date, name],
      );
      return toHoliday(res.rows[0] as Row);
    } catch (err) {
      if ((err as { code?: string }).code === '23505') {
        throw conflict(`${date} already has a holiday`);
      }
      throw err;
    }
  }

  async findForUpdate(tx: LeaveTx, id: string): Promise<Holiday | null> {
    const res = await tx.query<Row>(`SELECT ${COLUMNS} FROM holidays WHERE id = $1 FOR UPDATE`, [
      id,
    ]);
    return res.rows[0] ? toHoliday(res.rows[0]) : null;
  }

  async remove(tx: LeaveTx, id: string): Promise<void> {
    await tx.query(`DELETE FROM holidays WHERE id = $1`, [id]);
  }
}
