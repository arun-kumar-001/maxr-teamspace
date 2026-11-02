import type { PoolClient } from 'pg';

type Queryable = Pick<PoolClient, 'query'>;

/** The rows an employee points at, read under a share lock so none can be deactivated mid-write. */
export interface ReferenceRows {
  department: { isActive: boolean } | null;
  designation: { isActive: boolean; departmentId: string } | null;
  manager: { status: string } | null;
}

export interface ReferenceIds {
  departmentId: string;
  designationId: string;
  managerId?: string;
}

export interface ReferenceProblem {
  field: string;
  message: string;
}

export async function lockReferenceRows(tx: Queryable, ids: ReferenceIds): Promise<ReferenceRows> {
  const department = await tx.query<{ is_active: boolean }>(
    `SELECT is_active FROM departments WHERE id = $1 FOR SHARE`,
    [ids.departmentId],
  );
  const designation = await tx.query<{ is_active: boolean; department_id: string }>(
    `SELECT is_active, department_id FROM designations WHERE id = $1 FOR SHARE`,
    [ids.designationId],
  );
  const manager = ids.managerId
    ? await tx.query<{ status: string }>(`SELECT status FROM employees WHERE id = $1 FOR SHARE`, [
        ids.managerId,
      ])
    : null;
  const d = department.rows[0];
  const g = designation.rows[0];
  const m = manager?.rows[0];
  return {
    department: d ? { isActive: d.is_active } : null,
    designation: g ? { isActive: g.is_active, departmentId: g.department_id } : null,
    manager: m ? { status: m.status } : null,
  };
}

/** What is wrong with the department, designation and manager an employee is being given. */
export function referenceProblems(ids: ReferenceIds, refs: ReferenceRows): ReferenceProblem[] {
  const problems: ReferenceProblem[] = [];
  if (!refs.department) problems.push({ field: 'departmentId', message: 'Department not found' });
  else if (!refs.department.isActive)
    problems.push({ field: 'departmentId', message: 'Department is not active' });

  if (!refs.designation)
    problems.push({ field: 'designationId', message: 'Designation not found' });
  else if (!refs.designation.isActive)
    problems.push({ field: 'designationId', message: 'Designation is not active' });
  else if (refs.designation.departmentId !== ids.departmentId)
    problems.push({
      field: 'designationId',
      message: 'Designation does not belong to the department',
    });

  if (ids.managerId) {
    if (!refs.manager) problems.push({ field: 'managerId', message: 'Manager not found' });
    else if (refs.manager.status !== 'active')
      problems.push({ field: 'managerId', message: 'Manager is not an active employee' });
  }
  return problems;
}
