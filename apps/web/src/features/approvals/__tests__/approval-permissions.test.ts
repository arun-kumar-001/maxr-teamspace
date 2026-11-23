import { expect, it } from 'vitest';
import { canDecideApproval } from '../approval-permissions';
import type { Approval } from '../types';

const approval: Approval = {
  id: 'approval',
  subjectType: 'leave_request',
  subjectId: 'leave',
  requesterEmployeeId: 'staff',
  requesterName: 'Staff',
  requesterManagerId: 'lead',
  stages: ['hr'],
  currentStage: 0,
  status: 'pending',
  decisions: [],
  createdAt: new Date().toISOString(),
  decidedAt: null,
};

it('shows HR decisions only to HR and Admin-stage decisions only to Admin', () => {
  expect(canDecideApproval(approval, 'hr', ['hr_manager'])).toBe(true);
  expect(canDecideApproval(approval, 'admin', ['admin'])).toBe(false);
  expect(canDecideApproval({ ...approval, stages: ['admin'] }, 'admin', ['admin'])).toBe(true);
  expect(canDecideApproval({ ...approval, stages: ['admin'] }, 'hr', ['hr_manager'])).toBe(false);
});

it('requires the assigned Team Lead and blocks self-approval and repeat decisions', () => {
  const routed: Approval = { ...approval, stages: ['manager'] };
  expect(canDecideApproval(routed, 'lead', ['team_lead'])).toBe(true);
  expect(canDecideApproval(routed, 'other-lead', ['team_lead'])).toBe(false);
  expect(canDecideApproval(approval, 'staff', ['hr_manager'])).toBe(false);
  expect(canDecideApproval({ ...approval, status: 'approved' }, 'hr', ['hr_manager'])).toBe(false);
});

it('offers an own request for decision only when the server says nobody else could decide it', () => {
  const own: Approval = { ...approval, requesterEmployeeId: 'admin', stages: ['admin'] };
  expect(canDecideApproval(own, 'admin', ['admin'])).toBe(false);
  expect(canDecideApproval({ ...own, canDecideAsSoleApprover: false }, 'admin', ['admin'])).toBe(
    false,
  );
  expect(canDecideApproval({ ...own, canDecideAsSoleApprover: true }, 'admin', ['admin'])).toBe(
    true,
  );
  // The hint never helps with a request that is not yours, or one that is already decided.
  expect(canDecideApproval({ ...approval, canDecideAsSoleApprover: true }, 'staff2', [])).toBe(
    false,
  );
  expect(
    canDecideApproval({ ...own, status: 'approved', canDecideAsSoleApprover: true }, 'admin', [
      'admin',
    ]),
  ).toBe(false);
});
