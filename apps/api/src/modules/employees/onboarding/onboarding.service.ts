import { createHash, randomBytes } from 'node:crypto';
import { ROLES } from '@maxr/shared';
import { forbidden, notFound, unprocessable } from '../../../http/errors';
import { Logger, getLogger } from '../../../logging/logger';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import type { PasswordHasher } from '../../auth/password-hasher';
import { SessionRevoker } from '../deactivation/deactivation.types';
import { IOnboardingRepository, ScopeFilter } from './onboarding.repository';
import { canVerifyItem, checkActivationReadiness, deriveCurrentStep } from './onboarding.rules';
import {
  EmployeeStepDto,
  ListOnboardingQuery,
  OnboardingCaller,
  OnboardingChecklistDetail,
  OnboardingChecklistSummary,
  SetPasswordDto,
  VerifyItemDto,
} from './onboarding.types';

type Deps = Pick<PlatformServices, 'audit' | 'events' | 'notifications'>;

const TOKEN_EXPIRY_HOURS = 72;

export class OnboardingService {
  constructor(
    private readonly repository: IOnboardingRepository,
    private readonly platform: Deps,
    private readonly hasher: PasswordHasher,
    private readonly sessions: SessionRevoker,
    private readonly logger: Logger = getLogger(),
  ) {}

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  async list(
    caller: OnboardingCaller,
    query: ListOnboardingQuery,
  ): Promise<{ data: OnboardingChecklistSummary[]; total: number }> {
    const scope: ScopeFilter = {
      role: caller.roles.includes(ROLES.ADMIN)
        ? ROLES.ADMIN
        : caller.roles.includes(ROLES.HR_MANAGER)
          ? ROLES.HR_MANAGER
          : caller.roles.includes(ROLES.TEAM_LEAD)
            ? ROLES.TEAM_LEAD
            : ROLES.STAFF,
      callerEmployeeId: caller.employeeId,
      callerUserId: caller.actorId,
    };

    return this.repository.listChecklists(scope, query);
  }

  async get(caller: OnboardingCaller, employeeId: string): Promise<OnboardingChecklistDetail> {
    const detail = await this.repository.transaction(async (tx) => {
      return this.repository.ensureChecklist(tx, employeeId);
    });

    if (!detail) {
      throw notFound('Onboarding checklist not found');
    }

    // Record-scope checks (out-of-scope returns 404 per AGENTS.md)
    if (caller.roles.includes(ROLES.ADMIN) || caller.roles.includes(ROLES.HR_MANAGER)) {
      return detail;
    }

    if (caller.roles.includes(ROLES.TEAM_LEAD)) {
      if (detail.managerId !== caller.employeeId && detail.employeeId !== caller.employeeId) {
        throw notFound('Onboarding checklist not found');
      }
      return detail;
    }

    // Staff sees only own record
    if (detail.employeeId !== caller.employeeId) {
      throw notFound('Onboarding checklist not found');
    }

    return detail;
  }

  async getMe(caller: OnboardingCaller): Promise<OnboardingChecklistDetail> {
    const detail = await this.repository.transaction(async (tx) => {
      const existing = await this.repository.getChecklistDetailByUserId(tx, caller.actorId);
      if (existing) return existing;
      if (caller.employeeId) {
        return this.repository.ensureChecklist(tx, caller.employeeId);
      }
      return null;
    });

    if (!detail) {
      throw notFound('Onboarding checklist not found for current user');
    }

    return detail;
  }

  async verifyItem(
    caller: OnboardingCaller,
    employeeId: string,
    itemKey: string,
    dto: VerifyItemDto,
  ): Promise<OnboardingChecklistDetail> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();

    const result = await this.repository.transaction(async (tx) => {
      const checklist = await this.repository.ensureChecklist(tx, employeeId);
      const targetItem = checklist.items.find((i) => i.itemKey === itemKey);
      if (!targetItem) {
        throw notFound(`Onboarding item ${itemKey} not found`);
      }

      // Role check per step
      if (targetItem.step === 'hr') {
        if (!caller.roles.includes(ROLES.ADMIN) && !caller.roles.includes(ROLES.HR_MANAGER)) {
          throw forbidden('Only HR Manager or Admin can verify HR checklist items');
        }
      } else if (targetItem.step === 'it_admin') {
        if (!caller.roles.includes(ROLES.ADMIN)) {
          throw forbidden('Only Admin / IT can verify IT provisioning checklist items');
        }
      } else if (targetItem.step === 'employee') {
        if (
          !caller.roles.includes(ROLES.ADMIN) &&
          !caller.roles.includes(ROLES.HR_MANAGER) &&
          checklist.employeeId !== caller.employeeId
        ) {
          throw forbidden('Only the employee or HR can complete employee checklist items');
        }
      } else if (targetItem.step === 'system') {
        if (!caller.roles.includes(ROLES.ADMIN)) {
          throw forbidden('System checklist items are auto-managed');
        }
      }

      // Step sequence validation (illegal skips prevented)
      const check = canVerifyItem(targetItem, checklist.items);
      if (!check.allowed) {
        throw unprocessable(check.reason ?? 'Cannot verify item out of sequence');
      }

      await this.repository.verifyItem(tx, checklist.id, itemKey, caller.actorId, dto.notes);

      // Re-read detail and recalculate current step
      const updated = await this.repository.getChecklistDetail(tx, employeeId);
      if (!updated) throw notFound('Checklist not found after verification');

      const nextStep = deriveCurrentStep(updated.items);
      if (nextStep !== updated.currentStep) {
        await this.repository.updateChecklistState(
          tx,
          checklist.id,
          nextStep,
          updated.status,
          updated.completedAt,
        );
        updated.currentStep = nextStep;
      }

      await audit.record(
        {
          action: 'onboarding.verify_item',
          outcome: 'success',
          entityType: 'onboarding_item',
          entityId: targetItem.id,
          metadata: {
            employeeId,
            itemKey,
            step: targetItem.step,
            notes: dto.notes,
          },
        },
        { transaction: tx },
      );

      return updated;
    });

    events.add({
      type: 'onboarding.item_verified',
      payload: { employeeId, itemKey, currentStep: result.currentStep },
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await events.flush(this.platform.events);

    return result;
  }

  async unverifyItem(
    caller: OnboardingCaller,
    employeeId: string,
    itemKey: string,
  ): Promise<OnboardingChecklistDetail> {
    if (!caller.roles.includes(ROLES.ADMIN) && !caller.roles.includes(ROLES.HR_MANAGER)) {
      throw forbidden('Only Admin or HR Manager can unverify checklist items');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    let revokedUserId: string | null = null;

    const result = await this.repository.transaction(async (tx) => {
      const checklist = await this.repository.getChecklistDetail(tx, employeeId);
      if (!checklist) throw notFound('Onboarding checklist not found');

      const targetItem = checklist.items.find((i) => i.itemKey === itemKey);
      if (!targetItem) throw notFound(`Onboarding item ${itemKey} not found`);

      await this.repository.unverifyItem(tx, checklist.id, itemKey);

      // If the account was previously active or completed, reopen moves it back to pending
      if (checklist.status === 'completed' || checklist.employeeStatus === 'active') {
        const { userId } = await this.repository.reopenAccount(tx, employeeId);
        revokedUserId = userId;
      }

      const updated = await this.repository.getChecklistDetail(tx, employeeId);
      if (!updated) throw notFound('Checklist not found after unverify');

      const nextStep = deriveCurrentStep(updated.items);
      await this.repository.updateChecklistState(
        tx,
        checklist.id,
        nextStep === 'completed' ? 'employee' : nextStep,
        'in_progress',
        null,
      );
      updated.currentStep = nextStep === 'completed' ? 'employee' : nextStep;
      updated.status = 'in_progress';
      updated.completedAt = null;

      await audit.record(
        {
          action: 'onboarding.unverify_item',
          outcome: 'success',
          entityType: 'onboarding_item',
          entityId: targetItem.id,
          metadata: { employeeId, itemKey, step: targetItem.step },
        },
        { transaction: tx },
      );

      return updated;
    });

    if (revokedUserId) {
      await this.sessions.revokeAllForUser(revokedUserId).catch(() => undefined);
    }

    return result;
  }

  async generateSetPasswordToken(
    caller: OnboardingCaller,
    employeeId: string,
  ): Promise<{ expiresAt: string; token?: string }> {
    if (!caller.roles.includes(ROLES.ADMIN) && !caller.roles.includes(ROLES.HR_MANAGER)) {
      throw forbidden('Only Admin or HR Manager can generate set-password tokens');
    }

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 3600 * 1000);

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    const userEmail = await this.repository.transaction(async (tx) => {
      const checklist = await this.repository.ensureChecklist(tx, employeeId);
      if (!checklist) throw notFound('Employee checklist not found');

      const user = await this.repository.findUserByEmployeeId(tx, employeeId);
      if (!user) throw notFound('User account not found for employee');

      await this.repository.createSetPasswordToken(tx, user.id, tokenHash, expiresAt);

      await audit.record(
        {
          action: 'onboarding.generate_set_password_token',
          outcome: 'success',
          entityType: 'user',
          entityId: user.id,
          metadata: { employeeId, expiresAt: expiresAt.toISOString() },
        },
        { transaction: tx },
      );

      return user.email;
    });

    // Queue email with set-password claim link
    try {
      await this.platform.notifications.enqueueEmail({
        to: [userEmail],
        subject: 'Set up your password - MAXR Teamspace',
        text:
          `Hello,\n\n` +
          `Your MAXR Teamspace onboarding is in progress. Please use the following link within 72 hours to set your account password:\n\n` +
          `/set-password?token=${rawToken}\n\n` +
          `If you did not expect this invitation, please contact your administrator.`,
        dedupeKey: `employee:${employeeId}:set-password:${expiresAt.getTime()}`,
      });
    } catch (err) {
      this.logger.error('failed to queue set-password email', { employeeId, err });
    }

    return {
      expiresAt: expiresAt.toISOString(),
      token: rawToken, // Provided so clients/tests can access the generated link
    };
  }

  async setPassword(
    dto: SetPasswordDto,
    ip?: string,
  ): Promise<{ success: boolean; employeeId: string }> {
    const tokenHash = this.hashToken(dto.token);

    // Validate password complexity
    if (dto.newPassword.length < 12) {
      throw unprocessable('Password must be at least 12 characters');
    }
    if (dto.newPassword.length > 128) {
      throw unprocessable('Password must be at most 128 characters');
    }

    const passwordHash = await this.hasher.hash(dto.newPassword);

    const result = await this.repository.transaction(async (tx) => {
      const tokenRecord = await this.repository.findValidSetPasswordToken(tx, tokenHash);
      if (!tokenRecord) {
        throw unprocessable('Invalid or expired set-password token');
      }

      await this.repository.consumeSetPasswordToken(
        tx,
        tokenRecord.id,
        tokenRecord.userId,
        passwordHash,
      );

      const checklist = await this.repository.getChecklistDetail(tx, tokenRecord.employeeId);
      if (checklist) {
        await this.repository.verifyItem(
          tx,
          checklist.id,
          'password_set',
          tokenRecord.userId,
          'Password set via claim link',
        );

        const updated = await this.repository.getChecklistDetail(tx, tokenRecord.employeeId);
        if (updated) {
          const nextStep = deriveCurrentStep(updated.items);
          await this.repository.updateChecklistState(
            tx,
            checklist.id,
            nextStep,
            updated.status,
            updated.completedAt,
          );
        }
      }

      await this.platform.audit.record(
        {
          action: 'onboarding.set_password',
          outcome: 'success',
          entityType: 'user',
          entityId: tokenRecord.userId,
          metadata: { employeeId: tokenRecord.employeeId, ip },
        },
        { transaction: tx },
      );

      return { success: true, employeeId: tokenRecord.employeeId };
    });

    return result;
  }

  async completeEmployeeStep(
    caller: OnboardingCaller,
    employeeId: string,
    dto: EmployeeStepDto,
  ): Promise<OnboardingChecklistDetail> {
    if (
      !caller.roles.includes(ROLES.ADMIN) &&
      !caller.roles.includes(ROLES.HR_MANAGER) &&
      caller.employeeId !== employeeId
    ) {
      throw forbidden('You can only complete your own onboarding step');
    }

    if (!dto.profileConfirmed || !dto.policiesAcknowledged) {
      throw unprocessable(
        'Both profile confirmation and policy acknowledgment are required to complete this step',
      );
    }

    return this.repository.transaction(async (tx) => {
      const checklist = await this.repository.ensureChecklist(tx, employeeId);
      if (!checklist) throw notFound('Checklist not found');

      // Ensure IT step was completed first
      const itItems = checklist.items.filter((i) => i.step === 'it_admin');
      if (itItems.some((i) => !i.isVerified)) {
        throw unprocessable(
          'IT provisioning step must be verified before completing employee step',
        );
      }

      await this.repository.verifyItem(
        tx,
        checklist.id,
        'profile_reviewed',
        caller.actorId,
        dto.notes ?? 'Profile reviewed and confirmed',
      );
      await this.repository.verifyItem(
        tx,
        checklist.id,
        'policies_acknowledged',
        caller.actorId,
        dto.notes ?? 'Company policies acknowledged',
      );

      const updated = await this.repository.getChecklistDetail(tx, employeeId);
      if (!updated) throw notFound('Checklist not found');

      const nextStep = deriveCurrentStep(updated.items);
      await this.repository.updateChecklistState(
        tx,
        checklist.id,
        nextStep,
        updated.status,
        updated.completedAt,
      );
      updated.currentStep = nextStep;

      await this.platform.audit.record(
        {
          action: 'onboarding.complete_employee_step',
          outcome: 'success',
          entityType: 'onboarding_checklist',
          entityId: checklist.id,
          metadata: { employeeId },
        },
        { transaction: tx },
      );

      return updated;
    });
  }

  async activate(caller: OnboardingCaller, employeeId: string): Promise<OnboardingChecklistDetail> {
    if (!caller.roles.includes(ROLES.ADMIN) && !caller.roles.includes(ROLES.HR_MANAGER)) {
      throw forbidden('Only Admin or HR Manager can activate an onboarding account');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();

    const result = await this.repository.transaction(async (tx) => {
      const checklist = await this.repository.lockChecklist(tx, employeeId);
      if (!checklist) throw notFound('Employee onboarding checklist not found');

      // The Activation Gate: EVERY single item must be verified!
      const readiness = checkActivationReadiness(checklist.items);
      if (!readiness.ready) {
        throw unprocessable(
          'All checklist items must be verified before activating the account',
          readiness.unverifiedItems.map((item) => ({
            field: item,
            message: `Checklist item ${item} must be verified prior to activation`,
            code: 'ITEM_NOT_VERIFIED',
          })),
        );
      }

      // Activate in one atomic transaction:
      // 1. employees.status = 'active'
      // 2. users.is_active = true
      // 3. checklists.status = 'completed', current_step = 'completed', completed_at = NOW()
      await this.repository.activateAccount(tx, employeeId);
      await this.repository.updateChecklistState(
        tx,
        checklist.id,
        'completed',
        'completed',
        new Date(),
      );

      await audit.record(
        {
          action: 'onboarding.activate',
          outcome: 'success',
          entityType: 'employee',
          entityId: employeeId,
          changes: {
            employeeStatus: { from: checklist.employeeStatus, to: 'active' },
            userActive: { from: checklist.userActive, to: true },
            onboardingStatus: { from: checklist.status, to: 'completed' },
          },
        },
        { transaction: tx },
      );

      const updated = await this.repository.getChecklistDetail(tx, employeeId);
      return updated!;
    });

    events.add({
      type: 'employee.activated',
      payload: { employeeId, activatedBy: caller.actorId },
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    await events.flush(this.platform.events);

    // Queue congratulations / activated email
    try {
      await this.platform.notifications.enqueueEmail({
        to: [result.email],
        subject: 'Your MAXR Teamspace account is now active!',
        text:
          `Hello ${result.firstName},\n\n` +
          `Your onboarding has been completed and your MAXR Teamspace account is now fully active.\n` +
          `You may now log in to the workforce platform.\n`,
        dedupeKey: `employee:${employeeId}:activated`,
      });
    } catch (err) {
      this.logger.error('failed to queue activated email', { employeeId, err });
    }

    return result;
  }

  async reopen(
    caller: OnboardingCaller,
    employeeId: string,
    reason?: string,
  ): Promise<OnboardingChecklistDetail> {
    if (!caller.roles.includes(ROLES.ADMIN) && !caller.roles.includes(ROLES.HR_MANAGER)) {
      throw forbidden('Only Admin or HR Manager can reopen an onboarding checklist');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });

    let revokedUserId: string | null = null;

    const result = await this.repository.transaction(async (tx) => {
      const checklist = await this.repository.lockChecklist(tx, employeeId);
      if (!checklist) throw notFound('Employee onboarding checklist not found');

      // Move account back to pending and deactivate user
      const { userId } = await this.repository.reopenAccount(tx, employeeId);
      revokedUserId = userId;

      const derived = deriveCurrentStep(checklist.items);
      const targetStep = derived === 'completed' ? 'employee' : derived;

      await this.repository.updateChecklistState(tx, checklist.id, targetStep, 'in_progress', null);

      await audit.record(
        {
          action: 'onboarding.reopen',
          outcome: 'success',
          entityType: 'employee',
          entityId: employeeId,
          metadata: { reason },
          changes: {
            employeeStatus: { from: checklist.employeeStatus, to: 'pending' },
            userActive: { from: checklist.userActive, to: false },
            onboardingStatus: { from: checklist.status, to: 'in_progress' },
          },
        },
        { transaction: tx },
      );

      const updated = await this.repository.getChecklistDetail(tx, employeeId);
      return updated!;
    });

    if (revokedUserId) {
      await this.sessions.revokeAllForUser(revokedUserId).catch(() => undefined);
    }

    return result;
  }
}
