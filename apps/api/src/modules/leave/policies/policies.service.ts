import { conflict, notFound, unprocessable } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import { ILeavePoliciesRepository } from './policies.repository';
import type { CreateLeavePolicyInput, UpdateLeavePolicyInput } from './policies.schemas';
import { LeaveApprovalSettings, LeavePolicy, LeavePolicyValues, LeaveTx } from './policies.types';

type Deps = Pick<PlatformServices, 'audit'>;

export interface PolicyCaller {
  actorId: string;
  requestId?: string;
}

const EDITABLE = [
  'name',
  'isActive',
  'annualDays',
  'carryForwardMax',
  'allowHalfDay',
  'maxBackdateDays',
] as const;

/**
 * Leave types and their policies (D-12). Changing a policy does not touch balances that already
 * exist: they were allotted under the policy of their year, unless the caller asks for it
 * (`applyToCurrentBalances`), which sets this year's balances to the new policy and keeps the days
 * used. A new type, or one switched back on, gets its balances created for everyone straight away
 * (existing balances are left alone). Switching a type's balance on builds its balances from the
 * approved leave of the year; switching it off removes them, and is refused once days were used.
 */
export class LeavePoliciesService {
  constructor(
    private readonly repository: ILeavePoliciesRepository,
    private readonly platform: Deps,
    /** Creates the missing balances of the current year in the caller's transaction. */
    private readonly accrueCurrentYear?: (tx: LeaveTx) => Promise<number>,
    /** Brings one type's balances of the current year in line with its policy. */
    private readonly syncBalances?: (
      tx: LeaveTx,
      leaveTypeId: string,
      options: { rebuildUsed: boolean },
    ) => Promise<number>,
  ) {}

  list(): Promise<LeavePolicy[]> {
    return this.repository.list();
  }

  getApprovalSettings(tx?: LeaveTx): Promise<LeaveApprovalSettings> {
    return this.repository.getApprovalSettings(tx);
  }

  async updateApprovalSettings(
    input: LeaveApprovalSettings,
    caller: PolicyCaller,
  ): Promise<LeaveApprovalSettings> {
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const current = await this.repository.lockApprovalSettings(tx);
      if (current.version !== input.version)
        throw conflict('Approval settings changed. Reload and try again');
      if (current.approverRole === input.approverRole) return current;
      const updated = await this.repository.updateApprovalSettings(tx, input.approverRole);
      await audit.record(
        {
          action: 'leave_approval_settings.update',
          outcome: 'success',
          entityType: 'leave_approval_settings',
          changes: { approverRole: { from: current.approverRole, to: updated.approverRole } },
        },
        { transaction: tx },
      );
      return updated;
    });
  }

  /** One leave type with its policy, or null. The table is a handful of rows, so this reads the list. */
  async get(id: string): Promise<LeavePolicy | null> {
    return (await this.repository.list()).find((p) => p.id === id) ?? null;
  }

  async create(input: CreateLeavePolicyInput, caller: PolicyCaller): Promise<LeavePolicy> {
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const created = await this.repository.insert(tx, input);
      const balancesCreated =
        created.hasBalance && created.isActive ? ((await this.accrueCurrentYear?.(tx)) ?? 0) : 0;
      await audit.record(
        {
          action: 'leave_policy.create',
          outcome: 'success',
          entityType: 'leave_policy',
          entityId: created.id,
          changes: {
            code: created.code,
            hasBalance: created.hasBalance,
            annualDays: created.annualDays,
            carryForwardMax: created.carryForwardMax,
            allowHalfDay: created.allowHalfDay,
            maxBackdateDays: created.maxBackdateDays,
          },
          metadata: { balancesCreated },
        },
        { transaction: tx },
      );
      return created;
    });
  }

  async update(
    id: string,
    input: UpdateLeavePolicyInput,
    caller: PolicyCaller,
  ): Promise<LeavePolicy> {
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const current = await this.repository.findForUpdate(tx, id);
      if (!current) throw notFound('Leave type not found');
      if (current.version !== input.version) {
        throw conflict('This policy was changed by someone else; reload it and try again');
      }
      const hasBalance = input.hasBalance ?? current.hasBalance;
      const switchedBalanceOn = hasBalance && !current.hasBalance;
      const switchedBalanceOff = !hasBalance && current.hasBalance;
      const next: LeavePolicyValues = {
        name: input.name ?? current.name,
        isActive: input.isActive ?? current.isActive,
        // A type that stops keeping a balance has no days to give, unless the caller says otherwise.
        annualDays: input.annualDays ?? (switchedBalanceOff ? 0 : current.annualDays),
        carryForwardMax:
          input.carryForwardMax ?? (switchedBalanceOff ? 0 : current.carryForwardMax),
        allowHalfDay: input.allowHalfDay ?? current.allowHalfDay,
        maxBackdateDays: input.maxBackdateDays ?? current.maxBackdateDays,
      };
      if (!hasBalance && (next.annualDays !== 0 || next.carryForwardMax !== 0)) {
        throw unprocessable('A leave type without a balance has no annual days or carry forward');
      }
      if (switchedBalanceOff && (await this.repository.countUsedBalances(tx, id)) > 0) {
        throw conflict(
          'Some of this leave has already been used, so its balance cannot be switched off',
        );
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of EDITABLE) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      if (hasBalance !== current.hasBalance) {
        changes.hasBalance = { from: current.hasBalance, to: hasBalance };
      }
      // Nothing differs: no write, no version bump, no audit noise.
      if (Object.keys(changes).length === 0) return current;

      const updated = await this.repository.update(tx, id, next);
      if (switchedBalanceOn || switchedBalanceOff) {
        await this.repository.setHasBalance(tx, id, hasBalance);
        updated.hasBalance = hasBalance;
      }
      const policyChanged = 'annualDays' in changes || 'carryForwardMax' in changes;
      const reapply = hasBalance && input.applyToCurrentBalances === true && policyChanged;
      const switchedOn = !current.isActive && next.isActive && hasBalance;
      let balancesWritten = 0;
      if (switchedBalanceOff) {
        await this.repository.deleteBalances(tx, id);
      } else if (switchedBalanceOn || reapply) {
        balancesWritten = await this.syncBalancesOrExplain(tx, id, switchedBalanceOn);
      } else if (switchedOn) {
        balancesWritten = (await this.accrueCurrentYear?.(tx)) ?? 0;
      }
      await audit.record(
        {
          action: 'leave_policy.update',
          outcome: 'success',
          entityType: 'leave_policy',
          entityId: id,
          changes,
          ...(balancesWritten > 0 ? { metadata: { balancesCreated: balancesWritten } } : {}),
        },
        { transaction: tx },
      );
      return updated;
    });
  }

  /** A balance that would fall below the days already used is refused with the reason, not a 500. */
  private async syncBalancesOrExplain(
    tx: LeaveTx,
    id: string,
    rebuildUsed: boolean,
  ): Promise<number> {
    if (!this.syncBalances) return 0;
    try {
      return await this.syncBalances(tx, id, { rebuildUsed });
    } catch (err) {
      if ((err as { code?: string }).code === '23514') {
        throw unprocessable(
          'Some employees have already used or been approved for more days than this allows; raise the annual days or carry forward',
        );
      }
      throw err;
    }
  }

  /**
   * Deletes a leave type nobody has used. One with leave requests or used days keeps its history, so
   * it can only be deactivated.
   */
  async remove(id: string, caller: PolicyCaller): Promise<void> {
    const audit = this.platform.audit.withContext(caller);
    await this.repository.transaction(async (tx) => {
      const current = await this.repository.findForUpdate(tx, id);
      if (!current) throw notFound('Leave type not found');
      if ((await this.repository.countHistory(tx, id)) > 0) {
        throw conflict('This leave type has leave history. Deactivate it instead of deleting it');
      }
      await this.repository.remove(tx, id);
      await audit.record(
        {
          action: 'leave_policy.delete',
          outcome: 'success',
          entityType: 'leave_policy',
          entityId: id,
          changes: { code: current.code, name: current.name },
        },
        { transaction: tx },
      );
    });
  }
}
