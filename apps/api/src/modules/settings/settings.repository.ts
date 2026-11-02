import type { Pool } from 'pg';
import {
  COMPANY_SETTINGS_ID,
  CompanySettings,
  DayName,
  IntegrationToggles,
  UpdateSettingsDto,
  workDays,
} from './settings.types';

export interface ISettingsRepository {
  get(): Promise<CompanySettings>;
  update(dto: UpdateSettingsDto): Promise<CompanySettings>;
}

interface SettingsRow {
  company_name: string;
  timezone: string;
  work_week_start: DayName;
  work_week_end: DayName;
  integrations: IntegrationToggles;
  updated_at: Date | string;
}

const toSettings = (row: SettingsRow): CompanySettings => ({
  companyName: row.company_name,
  timezone: row.timezone,
  workWeek: {
    start: row.work_week_start,
    end: row.work_week_end,
    days: workDays(row.work_week_start, row.work_week_end),
  },
  integrations: row.integrations,
  updatedAt: new Date(row.updated_at).toISOString(),
});

const COLUMNS = `company_name, timezone, work_week_start, work_week_end, integrations, updated_at`;

/** The single settings row; the migration creates it and a CHECK keeps it the only one. */
export class PgSettingsRepository implements ISettingsRepository {
  constructor(private readonly getPool: () => Pool) {}

  async get(): Promise<CompanySettings> {
    const res = await this.getPool().query<SettingsRow>(
      `SELECT ${COLUMNS} FROM company_settings WHERE id = $1`,
      [COMPANY_SETTINGS_ID],
    );
    if (!res.rows[0]) {
      throw new Error('company_settings row is missing; run the database migrations');
    }
    return toSettings(res.rows[0]);
  }

  async update(dto: UpdateSettingsDto): Promise<CompanySettings> {
    const sets: string[] = [];
    const values: unknown[] = [COMPANY_SETTINGS_ID];
    const add = (sql: string, value: unknown) => {
      values.push(value);
      sets.push(sql.replace('?', `$${values.length}`));
    };
    if (dto.companyName !== undefined) add('company_name = ?', dto.companyName);
    if (dto.timezone !== undefined) add('timezone = ?', dto.timezone);
    if (dto.workWeek !== undefined) {
      add('work_week_start = ?', dto.workWeek.start);
      add('work_week_end = ?', dto.workWeek.end);
    }
    // Merging with `||` keeps the toggles the caller did not mention.
    if (dto.integrations !== undefined) {
      add('integrations = integrations || ?::jsonb', JSON.stringify(dto.integrations));
    }
    const res = await this.getPool().query<SettingsRow>(
      `UPDATE company_settings SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      values,
    );
    if (!res.rows[0]) {
      throw new Error('company_settings row is missing; run the database migrations');
    }
    return toSettings(res.rows[0]);
  }
}
