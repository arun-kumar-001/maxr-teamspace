import type { Pool, PoolClient } from 'pg';
import { ScopeFilter, scopeToSql } from '../../rbac';
import {
  EmployeeStatus,
  HierarchyTx,
  ManagedEmployee,
  ManagerChange,
  OrgListParams,
  OrgNode,
} from './hierarchy.types';

export interface IHierarchyRepository {
  transaction<T>(work: (tx: HierarchyTx) => Promise<T>): Promise<T>;
  /**
   * One lock for every change to the reporting tree. A loop check reads other people's rows, so
   * without it two moves made at the same moment (A under B, B under A) could each pass.
   */
  lockHierarchy(tx: HierarchyTx): Promise<void>;
  lockEmployee(tx: HierarchyTx, id: string): Promise<ManagedEmployee | null>;
  findManager(tx: HierarchyTx, id: string): Promise<{ status: EmployeeStatus } | null>;
  /** True when `candidateId` is `ancestorId` or reports to them, directly or through others. */
  isSelfOrDescendant(tx: HierarchyTx, ancestorId: string, candidateId: string): Promise<boolean>;
  setManager(tx: HierarchyTx, id: string, managerId: string | null): Promise<void>;
  loadChange(tx: HierarchyTx, id: string): Promise<ManagerChange>;
  /** Whether the employee exists inside `filter` or is `selfId`. */
  isVisible(id: string, filter: ScopeFilter, selfId: string): Promise<boolean>;
  listNodes(
    params: OrgListParams,
    filter: ScopeFilter,
  ): Promise<{ items: OrgNode[]; total: number }>;
}

interface NodeRow {
  id: string;
  employee_code: string;
  name: string;
  designation: string;
  status: EmployeeStatus;
  direct_report_count: number;
}

export class PgHierarchyRepository implements IHierarchyRepository {
  constructor(private readonly getPool: () => Pool) {}

  async transaction<T>(work: (tx: HierarchyTx) => Promise<T>): Promise<T> {
    const client: PoolClient = await this.getPool().connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async lockHierarchy(tx: HierarchyTx): Promise<void> {
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext('employees.hierarchy'))`);
  }

  async lockEmployee(tx: HierarchyTx, id: string): Promise<ManagedEmployee | null> {
    const res = await tx.query<{
      id: string;
      status: EmployeeStatus;
      version: number;
      manager_id: string | null;
    }>(`SELECT id, status, version, manager_id FROM employees WHERE id = $1 FOR UPDATE`, [id]);
    const r = res.rows[0];
    return r ? { id: r.id, status: r.status, version: r.version, managerId: r.manager_id } : null;
  }

  async findManager(tx: HierarchyTx, id: string): Promise<{ status: EmployeeStatus } | null> {
    const res = await tx.query<{ status: EmployeeStatus }>(
      `SELECT status FROM employees WHERE id = $1 FOR SHARE`,
      [id],
    );
    return res.rows[0] ?? null;
  }

  async isSelfOrDescendant(
    tx: HierarchyTx,
    ancestorId: string,
    candidateId: string,
  ): Promise<boolean> {
    // Walk up from the candidate. UNION (not UNION ALL) drops repeated rows, so a loop that was
    // already in the data cannot make the walk run forever.
    const res = await tx.query<{ found: boolean }>(
      `WITH RECURSIVE up(id, manager_id) AS (
         SELECT id, manager_id FROM employees WHERE id = $2
         UNION
         SELECT e.id, e.manager_id FROM employees e JOIN up ON e.id = up.manager_id
       )
       SELECT EXISTS (SELECT 1 FROM up WHERE id = $1) AS found`,
      [ancestorId, candidateId],
    );
    return res.rows[0]?.found ?? false;
  }

  async setManager(tx: HierarchyTx, id: string, managerId: string | null): Promise<void> {
    await tx.query(`UPDATE employees SET manager_id = $2 WHERE id = $1`, [id, managerId]);
  }

  async loadChange(tx: HierarchyTx, id: string): Promise<ManagerChange> {
    const res = await tx.query<{
      id: string;
      version: number;
      manager_id: string | null;
      manager_code: string | null;
      manager_name: string | null;
    }>(
      `SELECT e.id, e.version, e.manager_id, m.employee_code AS manager_code,
              TRIM(CONCAT(m.first_name, ' ', m.last_name)) AS manager_name
         FROM employees e LEFT JOIN employees m ON m.id = e.manager_id
        WHERE e.id = $1`,
      [id],
    );
    const r = res.rows[0];
    if (!r) throw new Error(`Employee ${id} vanished inside its transaction`);
    return {
      id: r.id,
      managerId: r.manager_id,
      manager: r.manager_id
        ? { id: r.manager_id, employeeCode: r.manager_code ?? '', name: r.manager_name ?? '' }
        : null,
      version: r.version,
    };
  }

  async isVisible(id: string, filter: ScopeFilter, selfId: string): Promise<boolean> {
    if (id === selfId) return true;
    const scope = scopeToSql(filter, 'e.id', 2);
    const res = await this.getPool().query(
      `SELECT 1 FROM employees e WHERE e.id = $1 AND ${scope.clause}`,
      [id, ...scope.values],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listNodes(params: OrgListParams, filter: ScopeFilter) {
    const values: unknown[] = [];
    const scope = scopeToSql(filter, 'e.id', 1);
    values.push(...scope.values);
    const conditions = [scope.clause];
    if (params.managerId === null) {
      conditions.push('e.manager_id IS NULL');
    } else {
      values.push(params.managerId);
      conditions.push(`e.manager_id = $${values.length}`);
    }
    if (params.status) {
      values.push(params.status);
      conditions.push(`e.status = $${values.length}`);
    } else {
      // The chart shows the people who work here, and the counts agree; leavers are reached with
      // status=deactivated.
      conditions.push(`e.status <> 'deactivated'`);
    }
    const where = conditions.join(' AND ');
    const count = await this.getPool().query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM employees e WHERE ${where}`,
      values,
    );
    const paging = [...values, params.limit, params.offset];
    const res = await this.getPool().query<NodeRow>(
      `SELECT e.id, e.employee_code, TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS name,
              g.title AS designation, e.status,
              (SELECT COUNT(*)::int FROM employees r
                WHERE r.manager_id = e.id AND r.status <> 'deactivated') AS direct_report_count
         FROM employees e JOIN designations g ON g.id = e.designation_id
        WHERE ${where}
        ORDER BY e.last_name, e.first_name, e.id
        LIMIT $${paging.length - 1} OFFSET $${paging.length}`,
      paging,
    );
    return {
      items: res.rows.map((r) => ({
        id: r.id,
        employeeCode: r.employee_code,
        name: r.name,
        designation: r.designation,
        status: r.status,
        directReportCount: r.direct_report_count,
      })),
      total: count.rows[0]?.count ?? 0,
    };
  }
}
