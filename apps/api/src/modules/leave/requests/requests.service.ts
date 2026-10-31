import { PaginatedResponse } from '@maxr/shared';
import { conflict, notFound, unprocessable } from '../../../http/errors';
import { buildPage, toOffsetLimit } from '../../../http/pagination';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import type {
  Approval,
  ApprovalHandler,
  ApprovalOutcome,
  ApprovalsService,
  ApprovalTx,
} from '../../approvals';
import { ScopeFilter } from '../../rbac';
import type { CompanySettingsReader } from '../../settings';
import type { HolidayReader } from '../holidays/holidays.types';
import type { LeavePolicy } from '../policies/policies.types';
import { countLeaveDays } from './leave-days';
import { ILeaveRequestsRepository } from './requests.repository';
import type {
  ApplyForLeaveInput,
  ListLeaveRequestsQuery,
  ListMyLeaveRequestsQuery,
} from './requests.schemas';
import { LeaveRequest } from './requests.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** The approvals subject type of a leave request. */
export const LEAVE_SUBJECT = 'leave_request';

export interface LeaveCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const localDate = (instant: Date, timeZone: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);

const minusDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);

export class LeaveRequestsService implements ApprovalHandler {
  readonly subjectType = LEAVE_SUBJECT;

  constructor(
    private readonly repository: ILeaveRequestsRepository,
    private readonly approvals: Pick<ApprovalsService, 'route' | 'submit'>,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly holidays: HolidayReader,
    private readonly policies: { get(id: string): Promise<LeavePolicy | null> },
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Applies for leave (D-12, D-30): checks the dates, counts the working days, checks the
   * balance, stores the request and opens its approval in one transaction. The request is
   * `applied` for an instant and `pending` once routed to an approver's inbox.
   */
  async request(input: ApplyForLeaveInput, caller: LeaveCaller): Promise<LeaveRequest> {
    const policy = await this.policies.get(input.leaveTypeId);
    if (!policy || !policy.isActive) throw unprocessable('Choose an active leave type');
    if (input.halfDay && !policy.allowHalfDay) {
      throw unprocessable(`${policy.name} cannot be taken as a half day`);
    }
    const year = Number(input.startDate.slice(0, 4));
    if (year !== Number(input.endDate.slice(0, 4))) {
      throw unprocessable(
        'A request must stay inside one calendar year; apply for each year separately',
      );
    }
    const { timezone, workWeek } = await this.settings.getBasic();
    const today = localDate(this.clock(), timezone);
    if (input.startDate < minusDays(today, policy.maxBackdateDays)) {
      throw unprocessable(
        policy.maxBackdateDays === 0
          ? `${policy.name} cannot start in the past`
          : `${policy.name} can start at most ${policy.maxBackdateDays} days in the past`,
      );
    }
    const days = countLeaveDays({
      startDate: input.startDate,
      endDate: input.endDate,
      halfDay: input.halfDay,
      workDays: workWeek.days,
      holidays: await this.holidays.datesBetween(input.startDate, input.endDate),
    });
    if (days === 0) throw unprocessable('There are no working days in this range');

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    const created = await this.repository.transaction(async (tx) => {
      if (policy.hasBalance) {
        const balance = await this.repository.lockBalance(tx, caller.employeeId, policy.id, year);
        if (!balance) throw unprocessable(`You have no ${policy.name} balance for ${year}`);
        if (balance.available < days) {
          throw unprocessable(
            `Not enough ${policy.name} left: ${balance.available} day(s) available, ${days} requested`,
          );
        }
      }
      const request = await this.repository.insert(tx, {
        employeeId: caller.employeeId,
        leaveTypeId: policy.id,
        startDate: input.startDate,
        endDate: input.endDate,
        halfDay: input.halfDay,
        days,
        reason: input.reason ?? null,
      });
      const stages = await this.approvals.route(tx, caller.employeeId);
      const approval = await this.approvals.submit(
        tx,
        {
          subjectType: LEAVE_SUBJECT,
          subjectId: request.id,
          requesterEmployeeId: caller.employeeId,
          stages,
        },
        events,
      );
      await this.repository.setStatus(tx, request.id, 'pending');
      // The reason can be private (sick leave), so the trail holds the facts around it only.
      await audit.record(
        {
          action: 'leave.apply',
          outcome: 'success',
          entityType: 'leave_request',
          entityId: request.id,
          metadata: {
            leaveType: policy.code,
            startDate: input.startDate,
            endDate: input.endDate,
            days,
            halfDay: input.halfDay,
          },
        },
        { transaction: tx },
      );
      return { ...request, status: 'pending' as const, approvalId: approval.id };
    });
    await events.flush(this.platform.events);
    return created;
  }

  /**
   * Called by the approvals engine inside the decision transaction. A rejection only closes the
   * request. An approval deducts the days from the balance and marks the request approved; if
   * the balance cannot cover it any more (other leave was approved first) the whole decision is
   * undone with a 409 and the approver can reject it instead.
   */
  async apply(
    tx: ApprovalTx,
    approval: Approval,
    outcome: ApprovalOutcome,
    decider: { employeeId: string; actorId: string; requestId?: string },
  ): Promise<void> {
    const request = await this.repository.findForUpdate(tx, approval.subjectId);
    if (!request || request.status !== 'pending') {
      throw new Error(`Leave request ${approval.subjectId} is not pending but its approval is`);
    }
    if (outcome === 'rejected') {
      await this.repository.setStatus(tx, request.id, 'rejected');
      return;
    }
    const policy = await this.policies.get(request.leaveTypeId);
    let changes: Record<string, { from: unknown; to: unknown }> | undefined;
    if (policy?.hasBalance) {
      const used = await this.repository.deduct(
        tx,
        request.employeeId,
        request.leaveTypeId,
        Number(request.startDate.slice(0, 4)),
        request.days,
      );
      if (!used) {
        throw conflict(
          'The balance no longer covers this request (other leave was approved first); reject it instead',
        );
      }
      changes = { balanceUsed: { from: used.usedBefore, to: used.usedAfter } };
    }
    await this.repository.setStatus(tx, request.id, 'approved');
    await this.platform.audit
      .withContext({ actorId: decider.actorId, requestId: decider.requestId })
      .record(
        {
          action: 'leave.approve',
          outcome: 'success',
          entityType: 'leave_request',
          entityId: request.id,
          changes,
          metadata: { leaveType: request.leaveTypeCode, days: request.days },
        },
        { transaction: tx },
      );
  }

  async listMine(
    query: ListMyLeaveRequestsQuery,
    caller: LeaveCaller,
  ): Promise<PaginatedResponse<LeaveRequest>> {
    return this.page(query, { kind: 'own', employeeId: caller.employeeId });
  }

  async list(
    query: ListLeaveRequestsQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<LeaveRequest>> {
    return this.page(query, filter);
  }

  /**
   * The requester's own request, or one inside `reviewScope` (the approvers' scope), so an
   * approver can see what they are asked to decide. Anything else is a 404.
   */
  async get(id: string, caller: LeaveCaller, reviewScope: ScopeFilter): Promise<LeaveRequest> {
    const own = await this.repository.find(id, { kind: 'own', employeeId: caller.employeeId });
    const found = own ?? (await this.repository.find(id, reviewScope));
    if (!found) throw notFound('Leave request not found');
    return found;
  }

  private async page(
    query: ListLeaveRequestsQuery | ListMyLeaveRequestsQuery,
    filter: ScopeFilter,
  ): Promise<PaginatedResponse<LeaveRequest>> {
    const { items, total } = await this.repository.findMany({
      filter,
      employeeId: 'employeeId' in query ? query.employeeId : undefined,
      status: query.status,
      leaveTypeId: query.leaveTypeId,
      from: query.from,
      to: query.to,
      ...toOffsetLimit(query),
    });
    return buildPage(items, total, query);
  }
}
