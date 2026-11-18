import { ROLES } from '@maxr/shared';
import { Approval, ApprovalStage, Decider, RequesterContext } from './approvals.types';

export type DenialReason = 'not_pending' | 'own_request' | 'not_your_stage' | 'already_decided';

export const currentStageOf = (approval: Approval): ApprovalStage | undefined =>
  approval.stages[approval.currentStage];

const isHr = (decider: Decider): boolean =>
  decider.roles.includes(ROLES.HR_MANAGER) || decider.roles.includes(ROLES.ADMIN);

/**
 * Whether `decider` may decide the approval's current stage right now, and why not.
 * Nobody decides their own request (D-12), and nobody decides two stages of one route (four eyes).
 * Leave decisions follow the configured role. Other subjects allow HR or Admin at the HR stage.
 */
export function denialReason(approval: Approval, decider: Decider): DenialReason | null {
  if (approval.status !== 'pending') return 'not_pending';
  if (approval.requesterEmployeeId === decider.employeeId) return 'own_request';
  if (approval.decisions.some((d) => d.decidedByEmployeeId === decider.employeeId)) {
    return 'already_decided';
  }
  const stage = currentStageOf(approval);
  if (stage === 'admin') return decider.roles.includes(ROLES.ADMIN) ? null : 'not_your_stage';
  if (approval.subjectType === 'leave_request') {
    if (stage === 'hr') return decider.roles.includes(ROLES.HR_MANAGER) ? null : 'not_your_stage';
    if (!decider.roles.includes(ROLES.TEAM_LEAD)) return 'not_your_stage';
  }
  const allowed =
    stage === 'manager'
      ? approval.requesterManagerId === decider.employeeId
      : stage === 'hr'
        ? isHr(decider)
        : false;
  return allowed ? null : 'not_your_stage';
}

export function leaveRoute(
  context: RequesterContext,
  approverRole: 'hr_manager' | 'team_lead',
): ApprovalStage[] {
  if (context.roles.includes(ROLES.HR_MANAGER)) return ['admin'];
  if (approverRole === 'team_lead' && context.managerId && context.managerIsTeamLead)
    return ['manager'];
  return ['hr'];
}

/**
 * The route for a new request (D-12, D-17): the requester's manager when there is one, then HR
 * when `twoStep`. Requesters who sit above the manager step (Team Lead, HR Manager, Admin) and
 * requesters without a manager go to HR only.
 */
export function defaultRoute(
  context: { managerId: string | null; roles: readonly string[] },
  twoStep: boolean,
): ApprovalStage[] {
  const aboveManager = context.roles.some(
    (role) => role === ROLES.TEAM_LEAD || role === ROLES.HR_MANAGER || role === ROLES.ADMIN,
  );
  if (!context.managerId || aboveManager) return ['hr'];
  return twoStep ? ['manager', 'hr'] : ['manager'];
}
