import { describe, expect, it } from 'vitest';
import { createTestPlatform } from '../../platform';
import { createLogger } from '../../logging/logger';
import { CachedCompanySettingsReader } from './settings.reader';
import { MemorySettingsRepository } from './settings.repository.memory';
import { isValidTimeZone, updateSettingsSchema } from './settings.schemas';
import { SettingsService } from './settings.service';
import { workDays } from './settings.types';

const silent = createLogger({ level: 'silent', write: () => undefined });

describe('timezone validation', () => {
  it.each(['Asia/Kolkata', 'UTC', 'Europe/London', 'America/Argentina/Buenos_Aires', 'Etc/GMT+5'])(
    'accepts %s',
    (tz) => expect(isValidTimeZone(tz)).toBe(true),
  );

  it.each([
    '',
    'Mars/Phobos',
    'IST',
    'Asia/Kolkata; DROP TABLE',
    '../etc/passwd',
    'a'.repeat(120),
    '+05:30',
  ])('rejects %j', (tz) => expect(isValidTimeZone(tz)).toBe(false));
});

describe('work week', () => {
  it('lists the days from start to end, wrapping over the weekend', () => {
    expect(workDays('Monday', 'Friday')).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);
    expect(workDays('Sunday', 'Thursday')).toEqual([
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
    ]);
    expect(workDays('Saturday', 'Tuesday')).toHaveLength(4);
  });
});

describe('update schema', () => {
  const parse = (v: unknown) => updateSettingsSchema.safeParse(v);

  it('accepts one field, trims the name, and accepts partial integrations', () => {
    expect(parse({ companyName: '  MAXR  ' })).toMatchObject({
      success: true,
      data: { companyName: 'MAXR' },
    });
    expect(parse({ integrations: { sms: true } }).success).toBe(true);
    expect(parse({ workWeek: { start: 'Sunday', end: 'Thursday' } }).success).toBe(true);
  });

  it.each([
    ['empty body', {}],
    ['unknown key', { companyName: 'X', role: 'admin' }],
    ['blank name', { companyName: '   ' }],
    ['bad timezone', { timezone: 'Mars/Phobos' }],
    ['same start and end day', { workWeek: { start: 'Monday', end: 'Monday' } }],
    ['bad day name', { workWeek: { start: 'Mon', end: 'Fri' } }],
    ['half a work week', { workWeek: { start: 'Monday' } }],
    ['empty integrations', { integrations: {} }],
    ['unknown integration', { integrations: { fax: true } }],
    ['non-boolean toggle', { integrations: { sms: 'yes' } }],
  ])('rejects %s', (_label, body) => {
    expect(parse(body).success).toBe(false);
  });
});

describe('settings service and cached reader', () => {
  const ctx = { actorId: 'u1', employeeId: 'e1', requestId: 'r1' };

  function setup() {
    const repo = new MemorySettingsRepository();
    let now = 1_000_000;
    const reader = new CachedCompanySettingsReader(repo, 60_000, () => now);
    const { platform, auditStore } = createTestPlatform({ logger: silent });
    const service = new SettingsService(repo, reader, platform);
    return { repo, reader, service, auditStore, advance: (ms: number) => (now += ms) };
  }

  it('serves basic settings from the cache until the TTL ends', async () => {
    const { repo, reader, advance } = setup();
    await reader.getBasic();
    await reader.getBasic();
    expect(repo.reads).toBe(1);
    advance(59_000);
    await reader.getBasic();
    expect(repo.reads).toBe(1);
    advance(2_000);
    await reader.getBasic();
    expect(repo.reads).toBe(2);
  });

  it('shows a change at once: the cache is invalidated by the update', async () => {
    const { reader, service } = setup();
    expect((await reader.getBasic()).timezone).toBe('Asia/Kolkata');
    await service.update({ timezone: 'UTC' }, ctx);
    expect((await reader.getBasic()).timezone).toBe('UTC');
    expect((await service.getBasic()).timezone).toBe('UTC');
  });

  it('merges integration toggles instead of replacing them', async () => {
    const { service } = setup();
    const after = await service.update({ integrations: { sms: true } }, ctx);
    expect(after.integrations).toEqual({
      email: true,
      sms: true,
      calendarSync: false,
      payrollExport: false,
    });
  });

  it('does not expose integrations through the basic reader', async () => {
    const { reader } = setup();
    expect(Object.keys(await reader.getBasic()).sort()).toEqual([
      'companyName',
      'timezone',
      'workWeek',
    ]);
  });

  it('audits every change with field names only, never values', async () => {
    const { service, auditStore } = setup();
    await service.update({ companyName: 'Secret Name Ltd', integrations: { sms: true } }, ctx);
    const entry = auditStore.list().find((e) => e.action === 'settings.update');
    expect(entry).toMatchObject({
      outcome: 'success',
      entityType: 'company_settings',
      changes: { fields: ['companyName', 'integrations'] },
    });
    expect(JSON.stringify(entry)).not.toContain('Secret Name');
  });

  it('records a failed update and leaves the cache valid', async () => {
    const { repo, service, auditStore } = setup();
    repo.update = async () => {
      throw new Error('db down');
    };
    await expect(service.update({ timezone: 'UTC' }, ctx)).rejects.toThrow('db down');
    expect(auditStore.list().find((e) => e.action === 'settings.update')).toMatchObject({
      outcome: 'failure',
    });
  });
});
