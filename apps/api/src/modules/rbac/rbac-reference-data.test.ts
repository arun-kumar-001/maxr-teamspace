import fs from 'fs';
import path from 'path';
import { ROLES, type Role } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG, PERMISSION_KEYS, grantFor } from './permission-catalog';

const sql = fs.readFileSync(
  path.resolve(__dirname, '../../db/migrations/20261030000001_rbac_reference_data.sql'),
  'utf8',
);

const ROLE_IDS: Record<Role, string> = {
  admin: '10000000-0000-0000-0000-000000000001',
  hr_manager: '10000000-0000-0000-0000-000000000002',
  team_lead: '10000000-0000-0000-0000-000000000003',
  staff: '10000000-0000-0000-0000-000000000004',
};

const section = (from: string, to?: string): string => {
  const start = sql.indexOf(from);
  expect(start, `${from} not found`).toBeGreaterThan(-1);
  return sql.slice(start, to ? sql.indexOf(to, start) : undefined);
};

describe('migration 20261030000001 matches the permission catalog', () => {
  it('declares exactly the four fixed roles', () => {
    const roles = section('INSERT INTO roles', 'INSERT INTO permissions');
    const keys = [...roles.matchAll(/'(1000[0-9a-f-]+)', '([a-z_]+)'/g)].map((m) => m[2]);
    expect(keys.sort()).toEqual(Object.values(ROLES).sort());
    for (const [role, id] of Object.entries(ROLE_IDS)) {
      expect(roles).toContain(`'${id}', '${role}'`);
    }
  });

  it('declares exactly the catalog permissions with their descriptions', () => {
    const perms = section('INSERT INTO permissions', 'INSERT INTO role_permissions');
    const rows = [
      ...perms.matchAll(/\('2000[0-9a-f-]+', '([a-z_.]+)', '([a-z_]+)', '([a-z_]+)', '([^']*)'\)/g),
    ];
    expect(rows.map((r) => r[1]).sort()).toEqual([...PERMISSION_KEYS].sort());
    for (const [, key, module, action, description] of rows) {
      expect(key).toBe(`${module}.${action}`);
      expect(description).toBe(
        PERMISSION_CATALOG[key as keyof typeof PERMISSION_CATALOG].description,
      );
    }
  });

  it.each(Object.values(ROLES))(
    'maps %s to exactly the permissions the catalog grants it',
    (role) => {
      const mappings = section('-- 3. Role Permissions');
      const marker = `SELECT '${ROLE_IDS[role]}', id FROM permissions`;
      const start = mappings.indexOf(marker);
      expect(start, `no mapping for ${role}`).toBeGreaterThan(-1);
      const block = mappings.slice(start, mappings.indexOf('ON CONFLICT', start));
      const inSql = block.includes('WHERE key IN')
        ? [...block.slice(block.indexOf('WHERE')).matchAll(/'([a-z_.]+)'/g)].map((m) => m[1])
        : [...PERMISSION_KEYS]; // no WHERE: every permission
      const inCatalog = PERMISSION_KEYS.filter((k) => grantFor(role, k) !== null);
      expect(inSql.sort()).toEqual(inCatalog.sort());
    },
  );
});
