import { RECORD_SCOPES, type RecordScope, type Role } from '@maxr/shared';
import { PermissionKey, grantFor } from './permission-catalog';

/** Wider scope wins when a user holds several roles. */
const SCOPE_RANK: Record<RecordScope, number> = {
  [RECORD_SCOPES.OWN]: 0,
  [RECORD_SCOPES.TEAM]: 1,
  [RECORD_SCOPES.HR]: 2,
  [RECORD_SCOPES.ALL]: 3,
};

/** The widest of several scopes; null entries (denied) are ignored, all-null gives null. */
export function widestScope(scopes: Array<RecordScope | null>): RecordScope | null {
  let best: RecordScope | null = null;
  for (const scope of scopes) {
    if (scope && (best === null || SCOPE_RANK[scope] > SCOPE_RANK[best])) {
      best = scope;
    }
  }
  return best;
}

/** The widest scope any of `roles` holds for `key`; null (deny) when none holds it. */
export function resolveScope(roles: readonly Role[], key: PermissionKey): RecordScope | null {
  return widestScope(roles.map((role) => grantFor(role, key)));
}

/**
 * What a repository applies to a query. `none` matches nothing: a missing or unknown scope
 * must narrow to nothing, never widen to everything.
 *
 * `hr` and `all` are both `all` here: the difference between them (security settings, audit
 * logs) is expressed by which permissions a role holds, not by the row filter.
 * `team` is the caller's direct reports (D-11), not the caller.
 */
export type ScopeFilter =
  | { kind: 'all' }
  | { kind: 'own'; employeeId: string }
  | { kind: 'team'; managerId: string }
  | { kind: 'none' };

export const NO_ACCESS: ScopeFilter = { kind: 'none' };

export function toScopeFilter(
  scope: RecordScope | null | undefined,
  actor: { employeeId: string },
): ScopeFilter {
  switch (scope) {
    case RECORD_SCOPES.ALL:
    case RECORD_SCOPES.HR:
      return { kind: 'all' };
    case RECORD_SCOPES.TEAM:
      return actor.employeeId ? { kind: 'team', managerId: actor.employeeId } : NO_ACCESS;
    case RECORD_SCOPES.OWN:
      return actor.employeeId ? { kind: 'own', employeeId: actor.employeeId } : NO_ACCESS;
    default:
      return NO_ACCESS;
  }
}

/**
 * In-memory twin of `scopeToSql`, for memory repositories and service-level checks.
 * `managerOfOwner` is the manager of the employee who owns the record.
 */
export function scopeAllows(
  filter: ScopeFilter,
  ownerEmployeeId: string,
  managerOfOwner: string | null | undefined,
): boolean {
  switch (filter.kind) {
    case 'all':
      return true;
    case 'own':
      return filter.employeeId === ownerEmployeeId;
    case 'team':
      return !!managerOfOwner && managerOfOwner === filter.managerId;
    default:
      return false;
  }
}

const COLUMN = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

/**
 * A parameterised SQL condition for "the row's employee column is in scope".
 * `column` is a code constant (for example `a.employee_id`), never user input.
 * Parameters are numbered from `firstParam`; append `values` to the query's parameter list.
 */
export function scopeToSql(
  filter: ScopeFilter,
  column: string,
  firstParam: number,
): { clause: string; values: string[] } {
  if (!COLUMN.test(column)) {
    throw new Error(`Unsafe scope column: ${column}`);
  }
  switch (filter.kind) {
    case 'all':
      return { clause: 'TRUE', values: [] };
    case 'own':
      return { clause: `${column} = $${firstParam}`, values: [filter.employeeId] };
    case 'team':
      return {
        clause: `${column} IN (SELECT id FROM employees WHERE manager_id = $${firstParam})`,
        values: [filter.managerId],
      };
    default:
      return { clause: 'FALSE', values: [] };
  }
}
