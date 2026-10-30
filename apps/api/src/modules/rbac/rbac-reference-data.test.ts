import fs from 'fs';
import path from 'path';
import { ROLES, type Role } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { PERMISSION_CATALOG, PERMISSION_KEYS, grantFor } from './permission-catalog';

const MIGRATIONS_DIR = path.resolve(__dirname, '../../db/migrations');
/** Every RBAC reference-data migration, in order: later ones add permissions. */
const sql = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.includes('_rbac_') && f.endsWith('.sql'))
  .sort()
  .map((f) => fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'))
  .join('\n');

const ROLE_IDS: Record<Role, string> = {
  admin: '10000000-0000-0000-0000-000000000001',
  hr_manager: '10000000-0000-0000-0000-000000000002',
  team_lead: '10000000-0000-0000-0000-000000000003',
  staff: '10000000-0000-0000-0000-000000000004',
};

describe('RBAC reference-data migrations match the permission catalog', () => {
  it('declares exactly the four fixed roles', () => {
    const keys = [...sql.matchAll(/\('(1000[0-9a-f-]+)', '([a-z_]+)', '/g)].map((m) => m[2]);
    expect(keys.sort()).toEqual(Object.values(ROLES).sort());
    for (const [role, id] of Object.entries(ROLE_IDS)) {
      expect(sql).toContain(`'${id}', '${role}'`);
    }
  });

  it('declares exactly the catalog permissions with their descriptions', () => {
    const rows = [
      ...sql.matchAll(/\('2000[0-9a-f-]+', '([a-z_.]+)', '([a-z_]+)', '([a-z_]+)', '([^']*)'\)/g),
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
      const blocks = [
        ...sql.matchAll(
          new RegExp(
            `SELECT '${ROLE_IDS[role]}', id FROM permissions\\s*(WHERE key IN \\(([^)]*)\\))?\\s*ON CONFLICT`,
            'g',
          ),
        ),
      ];
      expect(blocks.length, `no mapping for ${role}`).toBeGreaterThan(0);
      // A block without WHERE grants every permission that exists when it runs.
      const inSql = new Set<string>();
      for (const block of blocks) {
        if (block[2] === undefined) {
          PERMISSION_KEYS.forEach((k) => inSql.add(k));
        } else {
          [...block[2].matchAll(/'([a-z_.]+)'/g)].forEach((m) => inSql.add(m[1] as string));
        }
      }
      const inCatalog = PERMISSION_KEYS.filter((k) => grantFor(role, k) !== null);
      expect([...inSql].sort()).toEqual(inCatalog.sort());
    },
  );
});
