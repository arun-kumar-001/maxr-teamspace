import { randomBytes, randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { encryptSensitiveFields } from '../db/encrypt-fields';
import { closePool, getPool } from '../db/client';
import { PgEmployeeCreationRepository } from '../modules/employees/creation/creation.repository';
import { PgEmployeeDetailRepository } from '../modules/employees/detail/detail.repository';
import { PgPayslipsRepository } from '../modules/payslips/payslips.repository';
import { AesGcmFieldCipher } from './field-crypto';

const PAN = 'ABCDE1234F';
const AADHAAR = '123456789012';
const ACCOUNT = '000123456789';

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('Aadhaar, PAN and bank numbers at rest, against PostgreSQL', () => {
  let outer: PoolClient;
  const run = randomUUID().slice(0, 8);
  const cipher = new AesGcmFieldCipher(randomBytes(32).toString('base64'));
  const ids = { dept: '', desig: '' };

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT fields_tx',
      COMMIT: 'RELEASE SAVEPOINT fields_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT fields_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };
  const pool = () => nested(outer);

  const rawEmployee = async (id: string) =>
    (
      await outer.query<{
        pan_number: string;
        aadhaar_number: string;
        bank_account_number: string;
      }>('SELECT pan_number, aadhaar_number, bank_account_number FROM employees WHERE id = $1', [
        id,
      ])
    ).rows[0];

  const createEmployee = (n: number, repo: PgEmployeeCreationRepository) =>
    repo.transaction((tx) =>
      repo.insertAccount(
        tx,
        {
          employeeCode: `FLD-${run}-${n}`,
          firstName: 'Field',
          lastName: `Person${n}`,
          email: `field-${run}-${n}@fields.test`,
          departmentId: ids.dept,
          designationId: ids.desig,
          joiningDate: '2026-11-02',
          role: ROLES.STAFF,
          panNumber: PAN,
          aadhaarNumber: AADHAAR,
          bankAccountNumber: ACCOUNT,
        },
        'hash',
      ),
    );

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const dept = await outer.query<{ id: string }>(
      `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
      [`Fields ${run}`, `FLD-${run}`],
    );
    ids.dept = dept.rows[0]?.id ?? '';
    ids.desig =
      (
        await outer.query<{ id: string }>(
          `INSERT INTO designations (department_id, title) VALUES ($1, 'Worker') RETURNING id`,
          [ids.dept],
        )
      ).rows[0]?.id ?? '';
  });
  beforeEach(async () => {
    await outer.query('SAVEPOINT each_test');
  });
  afterEach(async () => {
    await outer.query('ROLLBACK TO SAVEPOINT each_test');
  });
  afterAll(async () => {
    await outer.query('ROLLBACK');
    outer.release();
    await closePool();
  });

  it('stores a new employee encrypted and returns it readable to someone allowed to see it', async () => {
    const repo = new PgEmployeeCreationRepository(pool, cipher);
    const created = await createEmployee(1, repo);

    const raw = await rawEmployee(created.id);
    for (const value of [raw?.pan_number, raw?.aadhaar_number, raw?.bank_account_number]) {
      expect(value).toMatch(/^enc:v1:/);
    }
    expect(JSON.stringify(raw)).not.toContain(PAN);
    expect(JSON.stringify(raw)).not.toContain(AADHAAR);
    expect(JSON.stringify(raw)).not.toContain(ACCOUNT);

    const detail = await new PgEmployeeDetailRepository(pool, cipher).findById(
      created.id,
      { kind: 'all' },
      true,
    );
    expect(detail).toMatchObject({
      panNumber: PAN,
      aadhaarNumber: AADHAAR,
      bankAccountNumber: ACCOUNT,
    });
  });

  it('does not return the numbers at all without the account permission', async () => {
    const created = await createEmployee(2, new PgEmployeeCreationRepository(pool, cipher));
    const detail = await new PgEmployeeDetailRepository(pool, cipher).findById(
      created.id,
      { kind: 'all' },
      false,
    );
    expect(JSON.stringify(detail)).not.toMatch(/enc:v1|ABCDE1234F|123456789012/);
  });

  it('cannot be read with a different key', async () => {
    const created = await createEmployee(3, new PgEmployeeCreationRepository(pool, cipher));
    const other = new AesGcmFieldCipher(randomBytes(32).toString('base64'));
    await expect(
      new PgEmployeeDetailRepository(pool, other).findById(created.id, { kind: 'all' }, true),
    ).rejects.toThrow(/wrong key or altered value/);
  });

  it('stores payslip PAN and account number encrypted and reads them back', async () => {
    const created = await createEmployee(4, new PgEmployeeCreationRepository(pool, cipher));
    const repo = new PgPayslipsRepository(pool, cipher);
    const slip = await repo.create({
      employeeId: created.id,
      payMonth: 7,
      payYear: 2026,
      status: 'draft',
      designation: 'Engineer',
      pan: PAN,
      accountNumber: ACCOUNT,
      basicSalary: 40000,
    });

    const raw = (
      await outer.query<{ pan: string; account_number: string }>(
        'SELECT pan, account_number FROM payslips WHERE id = $1',
        [slip.id],
      )
    ).rows[0];
    expect(raw?.pan).toMatch(/^enc:v1:/);
    expect(raw?.account_number).toMatch(/^enc:v1:/);
    expect(slip).toMatchObject({ pan: PAN, accountNumber: ACCOUNT });

    const edited = await repo.update(slip.id, { basicSalary: 41000 });
    expect(edited).toMatchObject({ pan: PAN, accountNumber: ACCOUNT });
    const after = (
      await outer.query<{ pan: string }>('SELECT pan FROM payslips WHERE id = $1', [slip.id])
    ).rows[0];
    expect(after?.pan).toMatch(/^enc:v1:/);
  });

  describe('encrypting values stored before this change', () => {
    const insertPlain = async (n: number) =>
      (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id,
              designation_id, pan_number, aadhaar_number, bank_account_number)
           VALUES ($1, 'Old', 'Row', $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            `OLD-${run}-${n}`,
            `old-${run}-${n}@fields.test`,
            ids.dept,
            ids.desig,
            PAN,
            AADHAAR,
            ACCOUNT,
          ],
        )
      ).rows[0]?.id as string;

    it('still reads a plain value before the backfill has run', async () => {
      const id = await insertPlain(1);
      const detail = await new PgEmployeeDetailRepository(pool, cipher).findById(
        id,
        { kind: 'all' },
        true,
      );
      expect(detail).toMatchObject({ panNumber: PAN, aadhaarNumber: AADHAAR });
    });

    it('encrypts them, leaves blanks alone, and is safe to run again', async () => {
      const id = await insertPlain(2);
      const blank = (
        await outer.query<{ id: string }>(
          `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id)
           VALUES ($1, 'No', 'Numbers', $2, $3, $4) RETURNING id`,
          [`OLD-${run}-B`, `blank-${run}@fields.test`, ids.dept, ids.desig],
        )
      ).rows[0]?.id as string;

      const first = await encryptSensitiveFields(pool(), cipher);
      expect(first['employees.pan_number']).toBeGreaterThanOrEqual(1);

      const raw = await rawEmployee(id);
      expect(raw?.pan_number).toMatch(/^enc:v1:/);
      expect(cipher.decrypt(raw?.pan_number ?? null, 'employees.pan_number')).toBe(PAN);
      expect(cipher.decrypt(raw?.aadhaar_number ?? null, 'employees.aadhaar_number')).toBe(AADHAAR);
      expect((await rawEmployee(blank))?.pan_number).toBeNull();

      const second = await encryptSensitiveFields(pool(), cipher);
      expect(second['employees.pan_number']).toBe(0);
      expect((await rawEmployee(id))?.pan_number).toBe(raw?.pan_number);
    });
  });
});
