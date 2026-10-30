import { describe, expect, it } from 'vitest';
import { NO_ACCESS, resolveScope, scopeAllows, scopeToSql, toScopeFilter } from './scope';

describe('resolveScope', () => {
  it('returns null (deny) when no role holds the permission', () => {
    expect(resolveScope(['staff'], 'employees.create')).toBeNull();
    expect(resolveScope([], 'employees.read')).toBeNull();
  });

  it('takes the widest scope across several roles', () => {
    expect(resolveScope(['staff', 'team_lead'], 'employees.read')).toBe('team');
    expect(resolveScope(['team_lead', 'hr_manager'], 'employees.read')).toBe('hr');
    expect(resolveScope(['staff', 'admin'], 'employees.read')).toBe('all');
  });
});

describe('toScopeFilter', () => {
  const actor = { employeeId: 'emp-1' };

  it('maps scopes to filters', () => {
    expect(toScopeFilter('all', actor)).toEqual({ kind: 'all' });
    expect(toScopeFilter('hr', actor)).toEqual({ kind: 'all' });
    expect(toScopeFilter('team', actor)).toEqual({ kind: 'team', managerId: 'emp-1' });
    expect(toScopeFilter('own', actor)).toEqual({ kind: 'own', employeeId: 'emp-1' });
  });

  it('denies, never widens, when the scope or the employee is missing', () => {
    expect(toScopeFilter(null, actor)).toEqual(NO_ACCESS);
    expect(toScopeFilter(undefined, actor)).toEqual(NO_ACCESS);
    expect(toScopeFilter('bogus' as never, actor)).toEqual(NO_ACCESS);
    expect(toScopeFilter('own', { employeeId: '' })).toEqual(NO_ACCESS);
    expect(toScopeFilter('team', { employeeId: '' })).toEqual(NO_ACCESS);
  });
});

describe('scopeAllows', () => {
  it("applies each filter to an owner and the owner's manager", () => {
    expect(scopeAllows({ kind: 'all' }, 'a', null)).toBe(true);
    expect(scopeAllows({ kind: 'own', employeeId: 'a' }, 'a', null)).toBe(true);
    expect(scopeAllows({ kind: 'own', employeeId: 'a' }, 'b', 'a')).toBe(false);
    expect(scopeAllows({ kind: 'team', managerId: 'm' }, 'a', 'm')).toBe(true);
    expect(scopeAllows({ kind: 'team', managerId: 'm' }, 'a', 'other')).toBe(false);
    expect(scopeAllows({ kind: 'team', managerId: 'm' }, 'a', null)).toBe(false);
    expect(scopeAllows({ kind: 'team', managerId: 'm' }, 'm', null)).toBe(false);
    expect(scopeAllows(NO_ACCESS, 'a', 'a')).toBe(false);
  });
});

describe('scopeToSql', () => {
  it('builds parameterised conditions', () => {
    expect(scopeToSql({ kind: 'all' }, 'a.employee_id', 3)).toEqual({ clause: 'TRUE', values: [] });
    expect(scopeToSql({ kind: 'own', employeeId: 'e' }, 'a.employee_id', 3)).toEqual({
      clause: 'a.employee_id = $3',
      values: ['e'],
    });
    expect(scopeToSql({ kind: 'team', managerId: 'm' }, 'employee_id', 1)).toEqual({
      clause: 'employee_id IN (SELECT id FROM employees WHERE manager_id = $1)',
      values: ['m'],
    });
    expect(scopeToSql(NO_ACCESS, 'employee_id', 1)).toEqual({ clause: 'FALSE', values: [] });
  });

  it('rejects a column that is not a plain identifier', () => {
    expect(() => scopeToSql({ kind: 'all' }, 'id; DROP TABLE users', 1)).toThrow(/Unsafe/);
    expect(() => scopeToSql({ kind: 'all' }, 'a.b.c', 1)).toThrow(/Unsafe/);
  });
});
