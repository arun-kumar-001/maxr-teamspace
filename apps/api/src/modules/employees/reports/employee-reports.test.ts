import { describe, expect, it } from 'vitest';
import { makeApp } from '../../../test/helpers';
import { ReportRegistry } from '../../reports';
import { ALL_ROLES, signInAs } from '../../rbac/rbac.testing';
import { registerEmployeeReports } from './employee-reports';

const NAMES = ['employee-directory', 'employee-headcount', 'joiners-leavers'];

describe('employee report definitions', () => {
  it('register under unique, valid names with at least one data permission and the columns they declare', () => {
    const registry = new ReportRegistry();
    registerEmployeeReports(registry, {
      getPool: () => {
        throw new Error('no database in this test');
      },
      settings: { getBasic: async () => ({}) as never },
    });
    expect(registry.all().map((d) => d.name)).toEqual(NAMES);
    for (const definition of registry.all()) {
      expect(definition.dataPermissions).toEqual(['employees.list']);
      expect(definition.columns.length).toBeGreaterThan(0);
    }
  });

  it('never declare a sensitive column (ID documents, bank, compensation)', () => {
    const registry = new ReportRegistry();
    registerEmployeeReports(registry, {
      getPool: () => {
        throw new Error('no database in this test');
      },
      settings: { getBasic: async () => ({}) as never },
    });
    const keys = registry.all().flatMap((d) => d.columns.map((c) => c.key.toLowerCase()));
    expect(
      keys.filter((k) => /bank|salary|compensation|pay|document|passport|tax/.test(k)),
    ).toEqual([]);
  });

  it('are registered by the default app, for the roles that may run reports', async () => {
    const { app, authKit } = makeApp();
    for (const role of ALL_ROLES) {
      const res = await (await signInAs(app, authKit, role)).get('/api/v1/reports');
      if (role === 'staff') {
        expect(res.status).toBe(403);
      } else {
        expect(res.status).toBe(200);
        expect(res.body.data.map((r: { name: string }) => r.name)).toEqual(NAMES);
      }
    }
  });

  it('are not added to a registry the caller supplies', async () => {
    const { app, authKit } = makeApp({ reportRegistry: new ReportRegistry() });
    const res = await (await signInAs(app, authKit, 'admin')).get('/api/v1/reports');
    expect(res.body.data).toEqual([]);
  });
});
