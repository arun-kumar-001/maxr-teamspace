import { randomUUID } from 'node:crypto';
import { conflict } from '../../../http/errors';
import type { LeaveTx } from '../policies/policies.types';
import { IHolidaysRepository } from './holidays.repository';
import { Holiday } from './holidays.types';

/** In-memory holidays for unit and HTTP tests (not shipped in the build). */
export class MemoryHolidaysRepository implements IHolidaysRepository {
  constructor(public holidays: Holiday[] = []) {}

  async transaction<T>(work: (tx: LeaveTx) => Promise<T>): Promise<T> {
    const snapshot = structuredClone(this.holidays);
    try {
      return await work({ query: async () => ({ rows: [] }) } as unknown as LeaveTx);
    } catch (err) {
      this.holidays = snapshot;
      throw err;
    }
  }

  async listYear(year: number): Promise<Holiday[]> {
    return this.holidays
      .filter((h) => h.date.startsWith(`${year}-`))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async datesBetween(from: string, to: string): Promise<string[]> {
    return this.holidays
      .map((h) => h.date)
      .filter((d) => d >= from && d <= to)
      .sort();
  }

  async insert(_tx: LeaveTx, date: string, name: string): Promise<Holiday> {
    if (this.holidays.some((h) => h.date === date)) throw conflict(`${date} already has a holiday`);
    const holiday = { id: randomUUID(), date, name };
    this.holidays.push(holiday);
    return { ...holiday };
  }

  async findForUpdate(_tx: LeaveTx, id: string): Promise<Holiday | null> {
    const found = this.holidays.find((h) => h.id === id);
    return found ? { ...found } : null;
  }

  async remove(_tx: LeaveTx, id: string): Promise<void> {
    this.holidays = this.holidays.filter((h) => h.id !== id);
  }
}
