import { ROLES, type Role } from '@maxr/shared';
import type { Approval } from './types';

export function canDecideApproval(
  approval: Approval,
  employeeId: string | undefined,
  roles: readonly Role[],
): boolean {
  if (!employeeId || approval.status !== 'pending' || approval.requesterEmployeeId === employeeId)
    return false;
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
