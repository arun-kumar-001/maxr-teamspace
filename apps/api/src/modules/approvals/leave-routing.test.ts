import { describe, expect, it } from 'vitest';
import { denialReason, leaveRoute } from './approval-rules';
import type { Approval, RequesterContext } from './approvals.types';

describe('leave approval routing', () => {
  const staff: RequesterContext = { managerId: 'lead', managerIsTeamLead: true, roles: ['staff'] };
  it.each(['staff', 'team_lead', 'admin'] as const)('routes %s leave to HR by default', (role) => {
    expect(leaveRoute({ ...staff, roles: [role] }, 'hr_manager')).toEqual(['hr']);
  });
  it.each(['hr_manager', 'team_lead'] as const)('routes HR leave to Admin in %s mode', (mode) => {
    expect(leaveRoute({ ...staff, roles: ['hr_manager'] }, mode)).toEqual(['admin']);
  });
  it('uses the assigned active Team Lead when enabled', () => {
    expect(leaveRoute(staff, 'team_lead')).toEqual(['manager']);
    expect(leaveRoute({ ...staff, managerIsTeamLead: false }, 'team_lead')).toEqual(['hr']);
    expect(leaveRoute({ ...staff, managerId: null }, 'team_lead')).toEqual(['hr']);
  });
  const approval = (stage: 'manager' | 'hr' | 'admin'): Approval => ({
    id: 'approval',
    subjectType: 'leave_request',
    subjectId: 'leave',
    requesterEmployeeId: 'staff',
    requesterName: 'Staff',
    requesterManagerId: 'lead',
    stages: [stage],
    currentStage: 0,
    status: 'pending',
    decisions: [],
    createdAt: new Date().toISOString(),
    decidedAt: null,
  });
  it('limits each stage to its configured role and rejects self-approval', () => {
    expect(denialReason(approval('hr'), { employeeId: 'admin', roles: ['admin'] })).toBe(
      'not_your_stage',
    );
    expect(denialReason(approval('hr'), { employeeId: 'hr', roles: ['hr_manager'] })).toBeNull();
    expect(denialReason(approval('admin'), { employeeId: 'hr', roles: ['hr_manager'] })).toBe(
      'not_your_stage',
    );
    expect(denialReason(approval('admin'), { employeeId: 'admin', roles: ['admin'] })).toBeNull();
    expect(
      denialReason(approval('manager'), { employeeId: 'lead', roles: ['team_lead'] }),
    ).toBeNull();
    expect(denialReason(approval('manager'), { employeeId: 'lead', roles: ['hr_manager'] })).toBe(
      'not_your_stage',
    );
    expect(denialReason(approval('hr'), { employeeId: 'staff', roles: ['hr_manager'] })).toBe(
      'own_request',
    );
  });
});
