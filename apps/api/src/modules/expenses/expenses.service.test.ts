import { ROLES } from '@maxr/shared';
import { describe, expect, it } from 'vitest';
import { createLogger } from '../../logging/logger';
import { createTestPlatform } from '../../platform';
import { MemoryApprovalsRepository } from '../approvals/approvals.repository.memory';
import { ApprovalsService } from '../approvals/approvals.service';
import { InMemoryExpensesRepository } from './expenses.repository.memory';
import { ExpensesService } from './expenses.service';
import type { ExpenseTx } from './expenses.types';

const silent = createLogger({ level: 'silent', write: () => undefined });
const CAT_1 = '50000000-0000-4000-a000-000000000001';
const dummyTx = {} as unknown as ExpenseTx;

function setup(options?: { clockDate?: string }) {
  const { platform, auditStore } = createTestPlatform({ logger: silent });
  const repo = new InMemoryExpensesRepository();
  const approvalsRepo = new MemoryApprovalsRepository();
  const approvals = new ApprovalsService(approvalsRepo, platform);

  const clock = () => new Date(options?.clockDate ?? '2026-11-03T10:00:00Z');
  const service = new ExpensesService(
    repo,
    approvals,
    platform,
    { getBasic: async () => ({ timezone: 'UTC' }) },
    clock,
  );
  approvals.registerHandler(service);

  // Setup sample employees in repository
  repo.setEmployee({
    id: 'emp-staff',
    name: 'Sam Staff',
    code: 'EMP001',
    managerId: 'emp-lead',
  });
  repo.setEmployee({
    id: 'emp-lead',
    name: 'Tara TeamLead',
    code: 'EMP002',
    managerId: 'emp-hr',
  });
  repo.setEmployee({
    id: 'emp-hr',
    name: 'Hana HR',
    code: 'EMP003',
    managerId: null,
  });

  approvalsRepo.requesters['emp-staff'] = {
    name: 'Sam Staff',
    managerId: 'emp-lead',
    roles: [ROLES.STAFF],
  };
  approvalsRepo.requesters['emp-lead'] = {
    name: 'Tara TeamLead',
    managerId: 'emp-hr',
    roles: [ROLES.TEAM_LEAD],
  };
  approvalsRepo.requesters['emp-hr'] = {
    name: 'Hana HR',
    managerId: null,
    roles: [ROLES.HR_MANAGER],
  };

  const callerStaff = {
    actorId: 'usr-staff',
    employeeId: 'emp-staff',
    roles: [ROLES.STAFF] as const,
  };

  const callerLead = {
    actorId: 'usr-lead',
    employeeId: 'emp-lead',
    roles: [ROLES.TEAM_LEAD] as const,
  };

  const callerHr = {
    actorId: 'usr-hr',
    employeeId: 'emp-hr',
    roles: [ROLES.HR_MANAGER] as const,
  };

  return {
    platform,
    auditStore,
    repo,
    approvals,
    approvalsRepo,
    service,
    callerStaff,
    callerLead,
    callerHr,
  };
}

describe('ExpensesService', () => {
  it('validates amount boundaries (zero, negative, max ₹100,000)', async () => {
    const { service, callerStaff } = setup();

    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 0,
        expenseDate: '2026-11-01',
        description: 'Zero amount',
      }),
    ).rejects.toThrow(/Amount must be greater than zero/);

    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: -500,
        expenseDate: '2026-11-01',
        description: 'Negative amount',
      }),
    ).rejects.toThrow(/Amount must be greater than zero/);

    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 10_000_001,
        expenseDate: '2026-11-01',
        description: 'Exceeding limit',
      }),
    ).rejects.toThrow(/Amount cannot exceed ₹100,000.00/);
  });

  it('validates 60-day limit and rejects future dates', async () => {
    const { service, callerStaff } = setup({ clockDate: '2026-11-03T10:00:00Z' });

    // Future date
    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 1000,
        expenseDate: '2026-11-04',
        description: 'Future claim',
      }),
    ).rejects.toThrow(/Expense date cannot be in the future/);

    // 61 days ago (before 2026-09-04)
    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 1000,
        expenseDate: '2026-09-01',
        description: 'Too old claim',
      }),
    ).rejects.toThrow(/Expense claim cannot be older than 60 days/);

    // Valid date within 60 days
    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 1000, // <= 20000 paise (₹200) -> no receipt required
      expenseDate: '2026-10-15',
      description: 'Auto fare',
    });

    expect(claim.status).toBe('submitted');
    expect(claim.amountPaise).toBe(1000);
  });

  it('requires receipt when amount exceeds ₹200.00 (20,000 paise)', async () => {
    const { service, callerStaff } = setup();

    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 20_001,
        expenseDate: '2026-11-01',
        description: 'Taxi without receipt',
      }),
    ).rejects.toThrow(/Receipt is required for expense claims over ₹200.00/);

    // Submitting with receipt succeeds
    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 50_000, // ₹500
      expenseDate: '2026-11-01',
      description: 'Taxi with receipt',
      receipt: {
        filename: 'taxi-bill.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 test receipt content'),
      },
    });

    expect(claim.status).toBe('submitted');
    expect(claim.receiptStorageKey).toBeTruthy();
    expect(claim.receiptFilename).toBe('taxi-bill.pdf');
  });

  it('rejects receipt exceeding 5 MB or unsupported MIME type', async () => {
    const { service, callerStaff } = setup();

    // Oversized buffer: > 5MB
    const bigBuffer = Buffer.alloc(5 * 1024 * 1024 + 10);
    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 30_000,
        expenseDate: '2026-11-01',
        description: 'Big file',
        receipt: {
          filename: 'big.pdf',
          declaredType: 'application/pdf',
          body: bigBuffer,
        },
      }),
    ).rejects.toThrow(/Receipt file size cannot exceed 5 MB/);

    // Unsupported type
    await expect(
      service.submitClaim(callerStaff, {
        categoryId: CAT_1,
        amountPaise: 30_000,
        expenseDate: '2026-11-01',
        description: 'Zip file',
        receipt: {
          filename: 'receipt.zip',
          declaredType: 'application/zip',
          body: Buffer.from('PK...'),
        },
      }),
    ).rejects.toThrow(/Receipt must be a PDF, JPEG, or PNG document/);
  });

  it('routes approvals through approvals engine (twoStep: manager -> hr)', async () => {
    const { service, approvals, callerStaff, callerLead } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 15_000,
      expenseDate: '2026-11-02',
      description: 'Client tea',
    });

    // Approval request was created
    const pendingList = await approvals.list(
      { page: 1, pageSize: 10, subjectType: 'expense_claim' },
      callerLead,
      { kind: 'all' },
    );
    expect(pendingList.data.length).toBe(1);
    const approval = pendingList.data[0];
    expect(approval).toBeDefined();
    expect(approval?.subjectId).toBe(claim.id);
    expect(approval?.stages).toEqual(['manager', 'hr']);
    expect(approval?.status).toBe('pending');
  });

  it('updates claim status to approved or rejected via approvals engine', async () => {
    const { service, approvals, repo, callerStaff, callerLead, callerHr } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 15_000,
      expenseDate: '2026-11-02',
      description: 'Client lunch',
    });

    const pendingList = await approvals.list(
      { page: 1, pageSize: 10, subjectType: 'expense_claim' },
      callerLead,
      { kind: 'all' },
    );
    const approvalId = pendingList.data[0]?.id;
    expect(approvalId).toBeDefined();
    if (!approvalId) throw new Error('approval missing');

    // Stage 1: Team lead approves
    await approvals.decide(approvalId, 'approved', 'Looks good', callerLead, { kind: 'all' });

    // Claim should still be submitted until route finishes
    let currentClaim = await repo.findClaimById(dummyTx, claim.id);
    expect(currentClaim?.status).toBe('submitted');

    // Stage 2: HR approves
    await approvals.decide(approvalId, 'approved', 'HR verified', callerHr, { kind: 'all' });

    // Now claim is approved!
    currentClaim = await repo.findClaimById(dummyTx, claim.id);
    expect(currentClaim?.status).toBe('approved');
  });

  it('records rejection reason when rejected by an approver', async () => {
    const { service, approvals, repo, callerStaff, callerLead } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 15_000,
      expenseDate: '2026-11-02',
      description: 'Personal lunch',
    });

    const pendingList = await approvals.list(
      { page: 1, pageSize: 10, subjectType: 'expense_claim' },
      callerLead,
      { kind: 'all' },
    );
    const approvalId = pendingList.data[0]?.id;
    expect(approvalId).toBeDefined();
    if (!approvalId) throw new Error('approval missing');

    // Manager rejects with comment
    await approvals.decide(
      approvalId,
      'rejected',
      'Personal expenses not reimbursable',
      callerLead,
      { kind: 'all' },
    );

    const rejectedClaim = await repo.findClaimById(dummyTx, claim.id);
    expect(rejectedClaim?.status).toBe('rejected');
    expect(rejectedClaim?.rejectionReason).toBe('Personal expenses not reimbursable');
  });

  it('allows claimant to cancel submitted claim, cancelling approval in engine', async () => {
    const { service, approvals, callerStaff, callerLead } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 10_000,
      expenseDate: '2026-11-02',
      description: 'Accidental submission',
    });

    // Claimant cancels
    const cancelled = await service.cancelClaim(claim.id, callerStaff);
    expect(cancelled.status).toBe('cancelled');

    // Approvals engine record is now cancelled
    const pendingList = await approvals.list(
      { page: 1, pageSize: 10, subjectType: 'expense_claim' },
      callerLead,
      { kind: 'all' },
    );
    expect(pendingList.data[0]?.status).toBe('cancelled');

    // Cannot cancel again
    await expect(service.cancelClaim(claim.id, callerStaff)).rejects.toThrow(
      /Cannot cancel an expense claim with status 'cancelled'/,
    );
  });

  it('allows HR to mark approved claim as reimbursed', async () => {
    const { service, approvals, callerStaff, callerLead, callerHr } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 10_000,
      expenseDate: '2026-11-02',
      description: 'Approved travel',
    });

    // Cannot reimburse while still submitted
    await expect(service.reimburseClaim(claim.id, callerHr)).rejects.toThrow(
      /Only approved expense claims can be marked as reimbursed/,
    );

    // Fast-forward approvals
    const approval = (await approvals.list({ page: 1, pageSize: 1 }, callerLead, { kind: 'all' }))
      .data[0];
    expect(approval).toBeDefined();
    if (!approval) throw new Error('approval missing');
    await approvals.decide(approval.id, 'approved', 'ok', callerLead, { kind: 'all' });
    await approvals.decide(approval.id, 'approved', 'ok', callerHr, { kind: 'all' });

    // Now HR marks as reimbursed
    const reimbursed = await service.reimburseClaim(claim.id, callerHr);
    expect(reimbursed.status).toBe('reimbursed');
    expect(reimbursed.reimbursedByEmployeeId).toBe('emp-hr');
    expect(reimbursed.reimbursedAt).toBeTruthy();
  });

  it('generates signed download link for claim receipt', async () => {
    const { service, callerStaff } = setup();

    const claim = await service.submitClaim(callerStaff, {
      categoryId: CAT_1,
      amountPaise: 25_000,
      expenseDate: '2026-11-02',
      description: 'Hotel stay',
      receipt: {
        filename: 'hotel-receipt.pdf',
        declaredType: 'application/pdf',
        body: Buffer.from('%PDF-1.4 test hotel content'),
      },
    });

    const link = await service.createReceiptDownloadLink(claim.id, callerStaff, {
      kind: 'own',
      employeeId: callerStaff.employeeId,
    });
    expect(link.url).toContain('/api/v1/files/');
    expect(link.expiresAt).toBeTruthy();
  });
});
