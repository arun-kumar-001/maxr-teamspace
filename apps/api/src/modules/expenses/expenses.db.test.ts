import { randomUUID } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import type { Pool, PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closePool, getPool } from '../../db/client';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { createApprovals } from '../approvals';
import type { ApprovalCaller } from '../approvals/approvals.service';
import { PgExpensesRepository } from './expenses.repository';
import { ExpensesService, type ExpenseCaller } from './expenses.service';
import { createExpenses } from './index';

const PDF = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(200)]);
const NOW = new Date('2026-10-31T10:00:00Z');

/** Real PostgreSQL inside one transaction that is rolled back (a savepoint per test). */
describe('expense claims against PostgreSQL', () => {
  let outer: PoolClient;
  let repo: PgExpensesRepository;
  let service: ExpensesService;
  let approvals: ReturnType<typeof createApprovals>;
  let travel: string;
  const run = randomUUID().slice(0, 8);
  const ids: Record<string, string> = {};

  const nested = (client: PoolClient): Pool => {
    const map: Record<string, string> = {
      BEGIN: 'SAVEPOINT expense_tx',
      COMMIT: 'RELEASE SAVEPOINT expense_tx',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT expense_tx',
    };
    const inner = {
      query: (sql: string, values?: unknown[]) => client.query(map[sql] ?? sql, values),
      release: () => undefined,
    };
    return { query: client.query.bind(client), connect: async () => inner } as unknown as Pool;
  };

  const employee = async (name: string, managerId: string | null = null) => {
    ids[name] = (
      await outer.query<{ id: string }>(
        `INSERT INTO employees (employee_code, first_name, last_name, email, department_id, designation_id, status, manager_id)
         VALUES ($1, $2, 'Ex', $3, $4, $5, 'active', $6) RETURNING id`,
        [`EX-${run}-${name}`, name, `${name}-${run}@expense.test`, ids.dept, ids.desig, managerId],
      )
    ).rows[0]?.id as string;
    return ids[name];
  };

  const refused = async (sql: string, values: unknown[]) => {
    await outer.query('SAVEPOINT refusal');
    const err = await outer.query(sql, values).then(
      () => null,
      (e: { code?: string }) => e,
    );
    await outer.query('ROLLBACK TO SAVEPOINT refusal');
    return err?.code ?? null;
  };

  const idOf = (name: string): string => {
    const id = ids[name];
    if (!id) throw new Error(`No test employee named ${name}`);
    return id;
  };
  const caller = (name: string): ExpenseCaller => ({ actorId: idOf(name), employeeId: idOf(name) });
  const approverCaller = (name: string, roles: ApprovalCaller['roles'] = []): ApprovalCaller => ({
    actorId: idOf(name),
    employeeId: idOf(name),
    roles,
  });

  beforeAll(async () => {
    outer = await getPool().connect();
    await outer.query('BEGIN');
    const silent = createLogger({ level: 'silent', write: () => undefined });
    const { platform } = createTestPlatform({ logger: silent });
    const pg = () => nested(outer);
    ids.dept = (
      await outer.query<{ id: string }>(
        `INSERT INTO departments (name, code) VALUES ($1, $2) RETURNING id`,
        [`Expense ${run}`, `EX-${run}`],
      )
    ).rows[0]?.id as string;
    ids.desig = (
      await outer.query<{ id: string }>(
        `INSERT INTO designations (department_id, title, code) VALUES ($1, 'Worker', $2) RETURNING id`,
        [ids.dept, `EX-${run}`],
      )
    ).rows[0]?.id as string;
    const lead = await employee('lead');
    await employee('staff', lead);
    await employee('other');
    await employee('hr');

    travel = (
      await outer.query<{ id: string }>(`SELECT id FROM expense_categories WHERE code = 'travel'`)
    ).rows[0]?.id as string;

    repo = new PgExpensesRepository(pg);
    approvals = createApprovals({
      platform,
      authenticate: (_req, _res, next) => next(),
      getPool: pg,
    });
    const expenses = createExpenses({
      platform,
      approvals: approvals.service,
      authenticate: (_req, _res, next) => next(),
      idempotencyStore: undefined as never,
      settings: {
        getBasic: async () =>
          ({
            companyName: 'T',
            timezone: 'UTC',
            workWeek: { start: 'Monday', end: 'Friday', days: [] },
          }) as never,
      },
      repository: repo,
      clock: () => NOW,
    });
    service = expenses.service;
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

  const claimDraft = async (name: string, amountMinor = 5_000) =>
    (
      await service.create(
        {
          categoryId: travel,
          expenseDate: '2026-10-30',
          amountMinor,
          description: 'Taxi to client',
        },
        caller(name),
      )
    ).id;

  describe('the migration', () => {
    it('seeds the six categories of D-17', async () => {
      const res = await outer.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM expense_categories
          WHERE code IN ('travel', 'meals', 'accommodation', 'office_supplies', 'client_entertainment', 'other')`,
      );
      expect(Number(res.rows[0]?.count)).toBe(6);
    });

    it('refuses an amount outside 1 to 100,000.00, an unknown status, a currency other than INR, and a receipt without its checksum', async () => {
      const insert = (
        amount: number,
        status = 'draft',
        currency = 'INR',
        sha: string | null = null,
      ) =>
        refused(
          `INSERT INTO expense_claims (employee_id, category_id, expense_date, amount_minor, status, currency, receipt_key, receipt_name, receipt_size, receipt_sha256)
           VALUES ($1, $2, '2026-10-30', $3, $4, $5, $6, $7, $8, $9)`,
          [
            ids.staff,
            travel,
            amount,
            status,
            currency,
            sha ? 'receipts/2026/10/x' : null,
            sha ? 'x.pdf' : null,
            sha ? 1 : null,
            sha,
          ],
        );
      expect(await insert(0)).toBe('23514');
      expect(await insert(10_000_001)).toBe('23514');
      expect(await insert(100, 'paid')).toBe('23514');
      expect(await insert(100, 'draft', 'USD')).toBe('23514');
      expect(await insert(100)).toBeNull();
      // A receipt key is only valid together with its checksum, name and size.
      expect(
        await refused(
          `INSERT INTO expense_claims (employee_id, category_id, expense_date, amount_minor, receipt_key)
           VALUES ($1, $2, '2026-10-30', 100, 'receipts/2026/10/partial')`,
          [ids.staff, travel],
        ),
      ).toBe('23514');
    });
  });

  describe('the flow through the services', () => {
    it('a claim is approved by the manager and HR, then reimbursed, with the database showing each step', async () => {
      const claimId = await claimDraft('staff');
      await service.attachReceipt(
        claimId,
        { body: PDF, filename: 'taxi.pdf', declaredType: 'application/pdf' },
        caller('staff'),
      );
      const submitted = await service.submit(claimId, caller('staff'));
      expect(submitted).toMatchObject({ status: 'submitted' });

      await approvals.service.decide(
        submitted.approvalId as string,
        'approved',
        undefined,
        approverCaller('lead'),
        { kind: 'team', managerId: ids.lead as string },
      );
      await approvals.service.decide(
        submitted.approvalId as string,
        'approved',
        undefined,
        approverCaller('hr', [ROLES.HR_MANAGER]),
        { kind: 'all' },
      );
      const approved = await repo.find(claimId, { kind: 'all' });
      expect(approved).toMatchObject({ status: 'approved' });
      expect(approved?.decidedAt).not.toBeNull();

      const paid = await service.reimburse(claimId, caller('hr'), { kind: 'all' });
      expect(paid).toMatchObject({ status: 'reimbursed' });
      const row = await outer.query<{ reimbursed_at: Date | null }>(
        `SELECT reimbursed_at FROM expense_claims WHERE id = $1`,
        [claimId],
      );
      expect(row.rows[0]?.reimbursed_at).not.toBeNull();
    });

    it('withdrawing a submitted claim also withdraws its approval in the database', async () => {
      const claimId = await claimDraft('staff');
      const submitted = await service.submit(claimId, caller('staff'));
      await service.cancel(claimId, caller('staff'));
      const approval = await outer.query<{ status: string }>(
        `SELECT status FROM approvals WHERE subject_type = 'expense_claim' AND subject_id = $1`,
        [claimId],
      );
      expect(approval.rows[0]?.status).toBe('cancelled');
      expect(submitted.approvalId).toBeTruthy();
    });
  });

  describe('scope and the receipt guard in SQL', () => {
    it('shows a claim to its manager and not to someone outside the team', async () => {
      const claimId = await claimDraft('staff');
      expect(
        await repo.find(claimId, { kind: 'team', managerId: ids.lead as string }),
      ).not.toBeNull();
      expect(await repo.find(claimId, { kind: 'team', managerId: ids.other as string })).toBeNull();
      expect(await repo.find(claimId, { kind: 'own', employeeId: ids.other as string })).toBeNull();
    });

    it('stores a receipt only while the claim is a draft, at the SQL level too', async () => {
      const claimId = await claimDraft('staff');
      await service.submit(claimId, caller('staff'));
      const attached = await repo.transaction((tx) =>
        repo.attachReceipt(tx, claimId, {
          key: 'receipts/2026/10/late',
          name: 'late.pdf',
          contentType: 'application/pdf',
          size: 10,
          sha256: 'a'.repeat(64),
        }),
      );
      expect(attached).toBe(false);
    });

    it('refuses a new claim in a deactivated category', async () => {
      await repo.setCategoryActive(travel, false);
      await expect(
        service.create(
          { categoryId: travel, expenseDate: '2026-10-30', amountMinor: 500, description: null },
          caller('staff'),
        ),
      ).rejects.toMatchObject({ statusCode: 422 });
      await repo.setCategoryActive(travel, true);
    });
  });
});
