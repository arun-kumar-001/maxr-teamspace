import { uuidString } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { MOCK_USERS } from '../auth/mockUsers';
import {
  FALLBACK_EMPLOYEES,
  FALLBACK_MANAGERS,
} from '../features/employees/hooks/useEmployeeDirectory';
import { DEMO_DIRECTORY_EMPLOYEE_IDS, DEMO_USER_EMPLOYEE_IDS } from '../lib/demo-ids';

const isUuid = (value: string | undefined) => uuidString.safeParse(value).success;

describe('demo employee ids are UUID-shaped, so a demo profile link is a valid one', () => {
  it('every demo id passes the same UUID check the API applies to :id', () => {
    for (const id of [...Object.values(DEMO_USER_EMPLOYEE_IDS), ...DEMO_DIRECTORY_EMPLOYEE_IDS]) {
      expect(isUuid(id), id).toBe(true);
    }
  });

  it('are all different, so no two demo people share a link', () => {
    const ids = [...Object.values(DEMO_USER_EMPLOYEE_IDS), ...DEMO_DIRECTORY_EMPLOYEE_IDS];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the demo sign-in users carry them', () => {
    for (const user of Object.values(MOCK_USERS)) {
      expect(isUuid(user.employeeId), `${user.role}: ${user.employeeId}`).toBe(true);
    }
  });

  it('the demo employee directory and its manager list carry them, never emp-N', () => {
    for (const employee of FALLBACK_EMPLOYEES) {
      expect(isUuid(employee.id), employee.id).toBe(true);
    }
    for (const manager of FALLBACK_MANAGERS) {
      expect(isUuid(manager.id), manager.id).toBe(true);
    }
  });
});
