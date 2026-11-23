import { ROLES, type Role } from '@maxr/shared';
import type { Approval } from './types';

export function canDecideApproval(
  approval: Approval,
  employeeId: string | undefined,
  roles: readonly Role[],
): boolean {
  if (!employeeId || approval.status !== 'pending') return false;
  // Your own request: only when the server says nobody else could decide it.
  if (approval.requesterEmployeeId === employeeId) {
    return approval.canDecideAsSoleApprover === true;
  }
  if (approval.decisions.some((decision) => decision.decidedByEmployeeId === employeeId))
    return false;
  const stage = approval.stages[approval.currentStage];
  if (stage === 'admin') return roles.includes(ROLES.ADMIN);
  if (stage === 'hr')
    return (
      roles.includes(ROLES.HR_MANAGER) ||
      (approval.subjectType !== 'leave_request' && roles.includes(ROLES.ADMIN))
    );
  return (
    stage === 'manager' &&
    approval.requesterManagerId === employeeId &&
    (approval.subjectType !== 'leave_request' || roles.includes(ROLES.TEAM_LEAD))
  );
}

export const APPROVED_IDS_STORAGE_KEY = 'maxr_approved_approval_ids';

export function getApprovedIds(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = localStorage.getItem(APPROVED_IDS_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function saveApprovedId(id: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const current = getApprovedIds();
    current.add(id);
    localStorage.setItem(APPROVED_IDS_STORAGE_KEY, JSON.stringify([...current]));
  } catch {
    // Ignore storage errors
  }
}
