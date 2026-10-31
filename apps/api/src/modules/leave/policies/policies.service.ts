import { conflict, notFound, unprocessable } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import { ILeavePoliciesRepository } from './policies.repository';
import type { CreateLeavePolicyInput, UpdateLeavePolicyInput } from './policies.schemas';
import { LeavePolicy, LeavePolicyValues } from './policies.types';

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
 * exist: they were allotted under the policy of their year. Run the accrual after adding a type.
 */
export class LeavePoliciesService {
  constructor(
    private readonly repository: ILeavePoliciesRepository,
    private readonly platform: Deps,
  ) {}

  list(): Promise<LeavePolicy[]> {
    return this.repository.list();
  }

  async create(input: CreateLeavePolicyInput, caller: PolicyCaller): Promise<LeavePolicy> {
    const audit = this.platform.audit.withContext(caller);
    return this.repository.transaction(async (tx) => {
      const created = await this.repository.insert(tx, input);
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
      const next: LeavePolicyValues = {
        name: input.name ?? current.name,
        isActive: input.isActive ?? current.isActive,
        annualDays: input.annualDays ?? current.annualDays,
        carryForwardMax: input.carryForwardMax ?? current.carryForwardMax,
        allowHalfDay: input.allowHalfDay ?? current.allowHalfDay,
        maxBackdateDays: input.maxBackdateDays ?? current.maxBackdateDays,
      };
      if (!current.hasBalance && (next.annualDays !== 0 || next.carryForwardMax !== 0)) {
        throw unprocessable('A leave type without a balance has no annual days or carry forward');
      }
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const key of EDITABLE) {
        if (current[key] !== next[key]) changes[key] = { from: current[key], to: next[key] };
      }
      // Nothing differs: no write, no version bump, no audit noise.
      if (Object.keys(changes).length === 0) return current;

      const updated = await this.repository.update(tx, id, next);
      await audit.record(
        {
          action: 'leave_policy.update',
          outcome: 'success',
          entityType: 'leave_policy',
          entityId: id,
          changes,
        },
        { transaction: tx },
      );
      return updated;
    });
  }
}
