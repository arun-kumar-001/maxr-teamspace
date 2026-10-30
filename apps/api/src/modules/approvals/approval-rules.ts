import { ROLES } from '@maxr/shared';
import { Approval, ApprovalStage, Decider } from './approvals.types';

export type DenialReason = 'not_pending' | 'own_request' | 'not_your_stage' | 'already_decided';

export const currentStageOf = (approval: Approval): ApprovalStage | undefined =>
  approval.stages[approval.currentStage];

const isHr = (decider: Decider): boolean =>
  decider.roles.includes(ROLES.HR_MANAGER) || decider.roles.includes(ROLES.ADMIN);

/**
 * Whether `decider` may decide the approval's current stage right now, and why not.
 * Nobody decides their own request (D-12), and nobody decides two stages of one route (four eyes).
 * The `manager` stage belongs to the requester's manager only; the `hr` stage to an HR Manager or Admin.
 */
export function denialReason(approval: Approval, decider: Decider): DenialReason | null {
  if (approval.status !== 'pending') return 'not_pending';
  if (approval.requesterEmployeeId === decider.employeeId) return 'own_request';
  if (approval.decisions.some((d) => d.decidedByEmployeeId === decider.employeeId)) {
    return 'already_decided';
  }
  const stage = currentStageOf(approval);
  const allowed =
    stage === 'manager'
      ? approval.requesterManagerId === decider.employeeId
      : stage === 'hr'
        ? isHr(decider)
        : false;
  return allowed ? null : 'not_your_stage';
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
