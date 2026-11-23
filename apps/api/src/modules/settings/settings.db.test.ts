import { afterAll, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { PgSettingsRepository } from './settings.repository';
import { COMPANY_SETTINGS_ID } from './settings.types';

describe('company settings against PostgreSQL', () => {
  const pool = getPool();
  const repo = new PgSettingsRepository(getPool);

  afterAll(async () => {
    await closePool();
  });

  /** Runs `work` in a transaction that is always rolled back, so the shared row is never changed. */
  async function rolledBack(
    work: (q: (sql: string, values?: unknown[]) => Promise<unknown>) => Promise<void>,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await work((sql, values) => client.query(sql, values));
    } finally {
      await client.query('ROLLBACK');
      client.release();
    }
  }

  it('the migration leaves exactly one settings row with the fixed id', async () => {
    const res = await pool.query<{ id: string }>('SELECT id FROM company_settings');
    expect(res.rows.map((r) => r.id)).toEqual([COMPANY_SETTINGS_ID]);
  });

  it('reads the row, with the work-week days derived and toggles present', async () => {
    const s = await repo.get();
    expect(s.workWeek.days.length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(s.integrations).sort()).toEqual([
      'calendarSync',
      'email',
      'payrollExport',
      'sms',
    ]);
    expect(new Date(s.updatedAt).getTime()).not.toBeNaN();
  });

  it('a second settings row is rejected by the database', async () => {
    await rolledBack(async (q) => {
      await expect(
        q(`INSERT INTO company_settings (id, company_name) VALUES (gen_random_uuid(), 'Second')`),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('a work-week day that is not a day name is rejected by the database', async () => {
    await rolledBack(async (q) => {
      await expect(
        q(`UPDATE company_settings SET work_week_start = 'Mon' WHERE id = $1`, [
          COMPANY_SETTINGS_ID,
        ]),
      ).rejects.toMatchObject({ code: '23514' });
    });
  });

  it('updates fields, merges toggles and keeps the others', async () => {
    const before = await repo.get();
    try {
      const after = await repo.update({
        companyName: 'Test Co',
        timezone: 'Asia/Dubai',
        workWeek: { start: 'Sunday', end: 'Thursday' },
        integrations: { sms: true },
      });
      expect(after).toMatchObject({ companyName: 'Test Co', timezone: 'Asia/Dubai' });
      expect(after.workWeek.days).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
      expect(after.integrations).toEqual({ ...before.integrations, sms: true });
      const partial = await repo.update({ integrations: { calendarSync: true } });
      expect(partial.integrations).toEqual({
        ...before.integrations,
        sms: true,
        calendarSync: true,
      });
      expect(partial.companyName).toBe('Test Co');
    } finally {
      await repo.update({
        companyName: before.companyName,
        timezone: before.timezone,
        workWeek: { start: before.workWeek.start, end: before.workWeek.end },
        integrations: before.integrations,
      });
    }
  });

  describe('policies and logo', () => {
    const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
    const LATE = {
      enabled: true,
      graceMinutes: 10,
      deductionType: 'fixed_amount',
      deductionAmount: 250,
      freeLateLimitCount: 2,
      halfDayCutoffMinutes: 120,
    } as const;

    it('stores and returns the logo and both policies, and keeps them on an unrelated update', async () => {
      try {
        await repo.update({
          companyLogo: LOGO,
          lateDeductionPolicy: LATE,
          permissionPolicy: { enabled: false, maxPermissionsPerMonth: 1, maxHoursPerPermission: 2 },
        });
        const after = await repo.update({ companyName: 'Policy Test Co' });
        expect(after.companyLogo).toBe(LOGO);
        expect(after.lateDeductionPolicy).toEqual(LATE);
        expect(after.permissionPolicy).toEqual({
          enabled: false,
          maxPermissionsPerMonth: 1,
          maxHoursPerPermission: 2,
        });
        expect(await repo.getLogo()).toBe(LOGO);
        expect((await repo.update({ companyLogo: null })).companyLogo).toBeNull();
      } finally {
        await pool.query(
          `UPDATE company_settings
              SET company_logo = NULL, late_deduction_policy = NULL, permission_policy = NULL
            WHERE id = $1`,
          [COMPANY_SETTINGS_ID],
        );
      }
    });

    it.each([
      ['an SVG', 'data:image/svg+xml;base64,PHN2Zz4='],
      ['a web address', 'https://example.com/logo.png'],
      ['script', 'data:text/html;base64,PHNjcmlwdD4='],
      ['an oversized image', `data:image/png;base64,${'A'.repeat(300_001)}`],
    ])('the database refuses %s as the logo, whatever wrote it', async (_label, value) => {
      await rolledBack(async (q) => {
        await expect(
          q(`UPDATE company_settings SET company_logo = $2 WHERE id = $1`, [
            COMPANY_SETTINGS_ID,
            value,
          ]),
        ).rejects.toMatchObject({ code: '23514' });
      });
    });

    it('the database refuses a policy that is not a JSON object', async () => {
      await rolledBack(async (q) => {
        await expect(
          q(`UPDATE company_settings SET late_deduction_policy = '[1]'::jsonb WHERE id = $1`, [
            COMPANY_SETTINGS_ID,
          ]),
        ).rejects.toMatchObject({ code: '23514' });
      });
    });
  });
});
