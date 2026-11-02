import { ROLES } from '@maxr/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { AppError } from '../../../http/app-error';
import type { PlatformServices } from '../../../platform';
import { createArgon2Hasher } from '../../auth/password-hasher';
import { InMemoryOnboardingRepository } from './onboarding.repository.memory';
import { OnboardingService } from './onboarding.service';
import { OnboardingCaller } from './onboarding.types';

function createPlatformMock() {
  const auditEntries: Array<{ action: string; outcome: string; metadata?: unknown }> = [];
  const events: Array<{ type: string; payload: unknown }> = [];
  const emails: Array<{ to: string[]; subject: string; text: string }> = [];

  const audit = {
    record: async (entry: { action: string; outcome: string; metadata?: unknown }) => {
      auditEntries.push(entry);
    },
    tryRecord: async (entry: { action: string; outcome: string; metadata?: unknown }) => {
      auditEntries.push(entry);
    },
    withContext: () => audit,
  };

  const eventBus = {
    emit: async (event: { type: string; payload: unknown }) => {
      events.push(event);
    },
    subscribe: () => () => {},
  };

  const notifications = {
    enqueueEmail: async (email: { to: string[]; subject: string; text: string }) => {
      emails.push(email);
    },
    enqueueNotification: async () => {},
  };

  return {
    audit: audit as unknown as PlatformServices['audit'],
    events: eventBus as unknown as PlatformServices['events'],
    notifications: notifications as unknown as PlatformServices['notifications'],
    entries: auditEntries,
    emittedEvents: events,
    queuedEmails: emails,
  };
}

describe('OnboardingService (D-20, #24)', () => {
  let repository: InMemoryOnboardingRepository;
  let platformMock: ReturnType<typeof createPlatformMock>;
  let revokedUsers: string[];
  let service: OnboardingService;

  const hrCaller: OnboardingCaller = {
    actorId: 'user-hr',
    employeeId: 'emp-hr',
    roles: [ROLES.HR_MANAGER],
  };

  const adminCaller: OnboardingCaller = {
    actorId: 'user-admin',
    employeeId: 'emp-admin',
    roles: [ROLES.ADMIN],
  };

  const staffCaller: OnboardingCaller = {
    actorId: 'user-staff',
    employeeId: 'emp-1',
    roles: [ROLES.STAFF],
  };

  const strangerCaller: OnboardingCaller = {
    actorId: 'user-stranger',
    employeeId: 'emp-99',
    roles: [ROLES.STAFF],
  };

  beforeEach(() => {
    repository = new InMemoryOnboardingRepository();
    platformMock = createPlatformMock();
    revokedUsers = [];

    const sessions = {
      revokeAllForUser: async (userId: string) => {
        revokedUsers.push(userId);
        return 1;
      },
    };

    service = new OnboardingService(repository, platformMock, createArgon2Hasher(), sessions);

    // Seed target employee (status = pending)
    repository.seedEmployee(
      {
        id: 'emp-1',
        employeeCode: 'EMP-001',
        firstName: 'Asha',
        lastName: 'Rao',
        email: 'asha@example.com',
        departmentId: 'dept-1',
        designationId: 'desig-1',
        managerId: 'emp-lead',
        status: 'pending',
        joiningDate: '2026-11-01',
      },
      {
        id: 'user-staff',
        employeeId: 'emp-1',
        email: 'asha@example.com',
        passwordHash: 'unusable-hash',
        isActive: false,
      },
    );
  });

  describe('Checklist initialization & 4-step sequence', () => {
    it('initializes 4 steps with default items, and system step is auto-verified', async () => {
      const checklist = await service.get(hrCaller, 'emp-1');
      expect(checklist.employeeId).toBe('emp-1');
      expect(checklist.status).toBe('in_progress');
      expect(checklist.currentStep).toBe('hr');

      const systemItems = checklist.items.filter((i) => i.step === 'system');
      expect(systemItems.length).toBeGreaterThan(0);
      expect(systemItems.every((i) => i.isVerified)).toBe(true);

      const hrItems = checklist.items.filter((i) => i.step === 'hr');
      expect(hrItems.every((i) => !i.isVerified)).toBe(true);
    });

    it('prevents illegal skips: IT step cannot be verified before HR step completes', async () => {
      await expect(
        service.verifyItem(adminCaller, 'emp-1', 'equipment_issued', {}),
      ).rejects.toThrow(/HR verification step must be completed first/);
    });

    it('enforces role separation: only HR or Admin can verify HR items', async () => {
      await expect(service.verifyItem(staffCaller, 'emp-1', 'id_proof', {})).rejects.toThrow(
        /Only HR Manager or Admin/,
      );

      const updated = await service.verifyItem(hrCaller, 'emp-1', 'id_proof', {
        notes: 'Passport verified',
      });
      const item = updated.items.find((i) => i.itemKey === 'id_proof');
      expect(item?.isVerified).toBe(true);
      expect(item?.notes).toBe('Passport verified');
    });

    it('enforces IT step role separation: only Admin/IT can verify IT items', async () => {
      // Complete HR step first
      await service.verifyItem(hrCaller, 'emp-1', 'id_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'address_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'signed_offer', {});
      await service.verifyItem(hrCaller, 'emp-1', 'profile_confirmed', {});

      // HR Manager cannot verify IT items
      await expect(service.verifyItem(hrCaller, 'emp-1', 'work_email', {})).rejects.toThrow(
        /Only Admin \/ IT can verify/,
      );

      // Admin can verify IT items
      const updated = await service.verifyItem(adminCaller, 'emp-1', 'work_email', {});
      expect(updated.items.find((i) => i.itemKey === 'work_email')?.isVerified).toBe(true);
    });
  });

  describe('Step 4: Token generation, set-password claim & employee step', () => {
    it('generates a 72-hour single-use token and queues claim email', async () => {
      const result = await service.generateSetPasswordToken(hrCaller, 'emp-1');
      expect(result.token).toBeDefined();
      expect(result.expiresAt).toBeDefined();

      expect(platformMock.queuedEmails.length).toBe(1);
      expect(platformMock.queuedEmails[0]!.to).toEqual(['asha@example.com']);
      expect(platformMock.queuedEmails[0]!.text).toContain('/set-password?token=');
    });

    it('sets password using the single-use token and auto-verifies password_set item', async () => {
      const { token } = await service.generateSetPasswordToken(hrCaller, 'emp-1');

      const outcome = await service.setPassword({
        token: token!,
        newPassword: 'CorrectHorseBatteryStaple123!',
      });
      expect(outcome.success).toBe(true);

      const checklist = await service.get(hrCaller, 'emp-1');
      const item = checklist.items.find((i) => i.itemKey === 'password_set');
      expect(item?.isVerified).toBe(true);

      // Token cannot be reused (single-use)
      await expect(
        service.setPassword({
          token: token!,
          newPassword: 'AnotherPassword123!',
        }),
      ).rejects.toThrow(/Invalid or expired set-password token/);
    });

    it('rejects passwords shorter than 12 characters', async () => {
      const { token } = await service.generateSetPasswordToken(hrCaller, 'emp-1');
      await expect(
        service.setPassword({
          token: token!,
          newPassword: 'short',
        }),
      ).rejects.toThrow(/Password must be at least 12 characters/);
    });

    it('employee completes profile review and policy acknowledgment', async () => {
      // Complete HR and IT steps
      await service.verifyItem(hrCaller, 'emp-1', 'id_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'address_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'signed_offer', {});
      await service.verifyItem(hrCaller, 'emp-1', 'profile_confirmed', {});
      await service.verifyItem(adminCaller, 'emp-1', 'work_email', {});
      await service.verifyItem(adminCaller, 'emp-1', 'equipment_issued', {});

      // Stranger cannot complete employee step
      await expect(
        service.completeEmployeeStep(strangerCaller, 'emp-1', {
          profileConfirmed: true,
          policiesAcknowledged: true,
        }),
      ).rejects.toThrow(/You can only complete your own onboarding step/);

      // Employee completes step
      const updated = await service.completeEmployeeStep(staffCaller, 'emp-1', {
        profileConfirmed: true,
        policiesAcknowledged: true,
      });

      expect(updated.items.find((i) => i.itemKey === 'profile_reviewed')?.isVerified).toBe(true);
      expect(updated.items.find((i) => i.itemKey === 'policies_acknowledged')?.isVerified).toBe(
        true,
      );
    });
  });

  describe('Activation Gate', () => {
    it('refuses to activate if any checklist item is unverified (422)', async () => {
      await expect(service.activate(hrCaller, 'emp-1')).rejects.toThrow(AppError);
      await expect(service.activate(hrCaller, 'emp-1')).rejects.toMatchObject({
        statusCode: 422,
        message: expect.stringContaining('All checklist items must be verified'),
      });
    });

    it('activates the account when all items across all 4 steps are verified', async () => {
      // 1. HR Step
      await service.verifyItem(hrCaller, 'emp-1', 'id_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'address_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'signed_offer', {});
      await service.verifyItem(hrCaller, 'emp-1', 'profile_confirmed', {});

      // 2. IT Step
      await service.verifyItem(adminCaller, 'emp-1', 'work_email', {});
      await service.verifyItem(adminCaller, 'emp-1', 'equipment_issued', {});

      // 3. Employee Step: set password
      const { token } = await service.generateSetPasswordToken(hrCaller, 'emp-1');
      await service.setPassword({
        token: token!,
        newPassword: 'MySecurePassword123!',
      });
      // Employee Step: profile & policies
      await service.completeEmployeeStep(staffCaller, 'emp-1', {
        profileConfirmed: true,
        policiesAcknowledged: true,
      });

      // 4. Activation
      const activated = await service.activate(hrCaller, 'emp-1');
      expect(activated.status).toBe('completed');
      expect(activated.currentStep).toBe('completed');
      expect(activated.employeeStatus).toBe('active');
      expect(activated.userActive).toBe(true);

      // Verify audit and event
      expect(platformMock.entries.some((e) => e.action === 'onboarding.activate')).toBe(true);
      expect(platformMock.emittedEvents.some((e) => e.type === 'employee.activated')).toBe(true);
    });
  });

  describe('Reopen and unverify', () => {
    it('unverifying an item moves an active account back to pending and revokes sessions', async () => {
      // Complete all items and activate
      await service.verifyItem(hrCaller, 'emp-1', 'id_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'address_proof', {});
      await service.verifyItem(hrCaller, 'emp-1', 'signed_offer', {});
      await service.verifyItem(hrCaller, 'emp-1', 'profile_confirmed', {});
      await service.verifyItem(adminCaller, 'emp-1', 'work_email', {});
      await service.verifyItem(adminCaller, 'emp-1', 'equipment_issued', {});
      const { token } = await service.generateSetPasswordToken(hrCaller, 'emp-1');
      await service.setPassword({ token: token!, newPassword: 'ValidPassword123!' });
      await service.completeEmployeeStep(staffCaller, 'emp-1', {
        profileConfirmed: true,
        policiesAcknowledged: true,
      });
      await service.activate(hrCaller, 'emp-1');

      // Now unverify an item
      const reopened = await service.unverifyItem(hrCaller, 'emp-1', 'id_proof');
      expect(reopened.status).toBe('in_progress');
      expect(reopened.employeeStatus).toBe('pending');
      expect(reopened.userActive).toBe(false);
      expect(revokedUsers).toContain('user-staff');
    });

    it('explicit reopen moves account back to pending and revokes sessions', async () => {
      const reopened = await service.reopen(hrCaller, 'emp-1', 'Missing additional paperwork');
      expect(reopened.status).toBe('in_progress');
      expect(reopened.employeeStatus).toBe('pending');
      expect(reopened.userActive).toBe(false);
      expect(revokedUsers).toContain('user-staff');
    });
  });

  describe('Scope enforcement', () => {
    it('staff cannot read another employees onboarding checklist (404)', async () => {
      await expect(service.get(strangerCaller, 'emp-1')).rejects.toThrow(/not found/);
    });

    it('staff can read own onboarding checklist via getMe', async () => {
      const me = await service.getMe(staffCaller);
      expect(me.employeeId).toBe('emp-1');
    });
  });
});
