import { type Role } from '@maxr/shared';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createErrorHandler } from '../../middleware/error-handler';
import { notFoundHandler } from '../../middleware/not-found';
import { requestIdMiddleware } from '../../middleware/request-id';
import { createTestPlatform } from '../../platform';
import { createTestAuth } from '../auth/auth.testing';
import { ALL_ROLES, SignedIn, signInAs } from '../rbac/rbac.testing';
import { createSettings } from './index';
import { MemorySettingsRepository } from './settings.repository.memory';

async function setup() {
  const silent = createLogger({ level: 'silent', write: () => undefined });
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const kit = createTestAuth(platform.audit);
  const settings = createSettings({
    platform,
    authenticate: kit.auth.authenticate,
    repository: new MemorySettingsRepository(),
  });
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json({ limit: '1mb' })); // as in app.ts, so the logo's own limit is what answers
  app.use('/api/v1/auth', kit.auth.router);
  app.use('/api/v1/settings', settings.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(silent));
  const as = {} as Record<Role, SignedIn>;
  for (const role of ALL_ROLES) as[role] = await signInAs(app, kit, role);
  return { app, as, auditStore, reader: settings.reader };
}

describe('settings API access', () => {
  it('every route answers 401 without a session', async () => {
    const { app } = await setup();
    for (const [method, path] of [
      ['get', '/api/v1/settings'],
      ['get', '/api/v1/settings/basic'],
      ['get', '/api/v1/settings/logo'],
      ['put', '/api/v1/settings'],
    ] as const) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s reading all settings gets %i', async (role, status) => {
    const { as } = await setup();
    const res = await as[role].get('/api/v1/settings');
    expect(res.status).toBe(status);
    if (status === 200) expect(res.body.data.integrations).toBeDefined();
  });

  it.each(ALL_ROLES)('%s can read the basic settings, and only those', async (role) => {
    const { as } = await setup();
    const res = await as[role].get('/api/v1/settings/basic');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data).sort()).toEqual(['companyName', 'timezone', 'workWeek']);
    expect(res.body.data.workWeek.days).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
    ]);
  });

  it.each([
    ['admin', 200],
    ['hr_manager', 403],
    ['team_lead', 403],
    ['staff', 403],
  ] as const)('%s changing settings gets %i', async (role, status) => {
    const { as } = await setup();
    expect((await as[role].put('/api/v1/settings', { timezone: 'UTC' })).status).toBe(status);
  });

  it('a change by the Admin is visible to every role immediately and audited', async () => {
    const { as, auditStore } = await setup();
    const put = await as.admin.put('/api/v1/settings', {
      timezone: 'Asia/Dubai',
      workWeek: { start: 'Sunday', end: 'Thursday' },
    });
    expect(put.status).toBe(200);
    const seen = await as.staff.get('/api/v1/settings/basic');
    expect(seen.body.data.timezone).toBe('Asia/Dubai');
    expect(seen.body.data.workWeek.days[0]).toBe('Sunday');
    expect(auditStore.list().find((e) => e.action === 'settings.update')).toMatchObject({
      outcome: 'success',
      actorId: expect.any(String),
    });
  });

  it('a refused change (wrong role) leaves the settings and the audit trail untouched', async () => {
    const { as, auditStore } = await setup();
    await as.hr_manager.put('/api/v1/settings', { timezone: 'UTC' });
    expect((await as.admin.get('/api/v1/settings')).body.data.timezone).toBe('Asia/Kolkata');
    expect(auditStore.list().some((e) => e.action === 'settings.update')).toBe(false);
  });

  it.each([
    ['empty body', {}],
    ['unknown field', { timezone: 'UTC', admin: true }],
    ['invalid timezone', { timezone: 'Mars/Phobos' }],
    ['equal work-week days', { workWeek: { start: 'Friday', end: 'Friday' } }],
    ['unknown toggle', { integrations: { fax: true } }],
  ])('rejects %s with 400', async (_label, body) => {
    const { as } = await setup();
    expect((await as.admin.put('/api/v1/settings', body)).status).toBe(400);
  });

  describe('late-deduction policy, permission policy and company logo', () => {
    const LOGO = 'data:image/png;base64,iVBORw0KGgo=';
    const LATE = {
      enabled: true,
      graceMinutes: 10,
      deductionType: 'half_day_salary',
      deductionAmount: 0,
      freeLateLimitCount: 3,
      halfDayCutoffMinutes: 90,
    };
    const PERMISSION = {
      enabled: true,
      maxPermissionsPerMonth: 2,
      maxHoursPerPermission: 2,
      approvalFlow: 'hr_only',
    };

    it('starts as never configured, not as invented defaults', async () => {
      const { as } = await setup();
      const body = (await as.admin.get('/api/v1/settings')).body.data;
      expect(body).toMatchObject({
        companyLogo: null,
        lateDeductionPolicy: null,
        permissionPolicy: null,
      });
    });

    it('are saved by the Admin, read back by the Admin, and the logo is seen by every role', async () => {
      const { as, auditStore } = await setup();
      const put = await as.admin.put('/api/v1/settings', {
        companyLogo: LOGO,
        lateDeductionPolicy: LATE,
        permissionPolicy: PERMISSION,
      });
      expect(put.status).toBe(200);

      const all = (await as.admin.get('/api/v1/settings')).body.data;
      expect(all).toMatchObject({
        companyLogo: LOGO,
        lateDeductionPolicy: LATE,
        permissionPolicy: PERMISSION,
      });
      for (const role of ALL_ROLES) {
        const res = await as[role].get('/api/v1/settings/logo');
        expect(res.status, role).toBe(200);
        expect(res.body.data).toEqual({ companyLogo: LOGO });
      }
      // The audit trail names the fields, never the values (the logo is large).
      const audit = auditStore.list().find((e) => e.action === 'settings.update');
      expect(JSON.stringify(audit)).toContain('lateDeductionPolicy');
      expect(JSON.stringify(audit)).not.toContain('iVBORw0KGgo');
    });

    it('keeps the policies when only another field is changed', async () => {
      const { as } = await setup();
      await as.admin.put('/api/v1/settings', { lateDeductionPolicy: LATE });
      await as.admin.put('/api/v1/settings', { timezone: 'UTC' });
      expect((await as.admin.get('/api/v1/settings')).body.data.lateDeductionPolicy).toEqual(LATE);
    });

    it('removes the logo when null is sent', async () => {
      const { as } = await setup();
      await as.admin.put('/api/v1/settings', { companyLogo: LOGO });
      await as.admin.put('/api/v1/settings', { companyLogo: null });
      expect((await as.staff.get('/api/v1/settings/logo')).body.data.companyLogo).toBeNull();
    });

    it.each(['hr_manager', 'team_lead', 'staff'] as const)(
      '%s cannot change them, and nothing changes',
      async (role) => {
        const { as } = await setup();
        const res = await as[role].put('/api/v1/settings', {
          companyLogo: LOGO,
          lateDeductionPolicy: LATE,
        });
        expect(res.status).toBe(403);
        expect((await as.admin.get('/api/v1/settings')).body.data.companyLogo).toBeNull();
      },
    );

    it.each([
      [
        'an SVG logo, which can carry script',
        { companyLogo: 'data:image/svg+xml;base64,PHN2Zz4=' },
      ],
      ['a logo that is a web address', { companyLogo: 'https://example.com/logo.png' }],
      ['a script URL as the logo', { companyLogo: 'javascript:alert(1)' }],
      [
        'a logo over the size limit',
        { companyLogo: `data:image/png;base64,${'A'.repeat(300_001)}` },
      ],
      ['a negative grace period', { lateDeductionPolicy: { ...LATE, graceMinutes: -1 } }],
      ['an unknown deduction type', { lateDeductionPolicy: { ...LATE, deductionType: 'seize' } }],
      ['an extra policy field', { lateDeductionPolicy: { ...LATE, admin: true } }],
      [
        'a permission longer than a day',
        { permissionPolicy: { ...PERMISSION, maxHoursPerPermission: 30 } },
      ],
      ['an unknown approval flow', { permissionPolicy: { ...PERMISSION, approvalFlow: 'nobody' } }],
    ])('rejects %s with 400', async (_label, body) => {
      const { as } = await setup();
      expect((await as.admin.put('/api/v1/settings', body)).status).toBe(400);
    });
  });
});
