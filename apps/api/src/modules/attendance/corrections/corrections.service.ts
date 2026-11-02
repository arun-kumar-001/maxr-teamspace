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
import type { ShiftResolver } from '../../shifts';
import { checkInStatus } from '../attendance.service';
import { ICorrectionsRepository } from './corrections.repository';
import type { ListCorrectionsQuery, RequestCorrectionInput } from './corrections.schemas';
import {
  AttendanceCorrection,
  CORRECTION_SUBJECT,
  CORRECTION_WINDOW_DAYS,
  MAX_CORRECTED_SESSION_MINUTES,
} from './corrections.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

export interface CorrectionCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** `YYYY-MM-DD` of an instant on the company clock. */
function localDate(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(instant);
}

function minusDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

export class AttendanceCorrectionsService implements ApprovalHandler {
  readonly subjectType = CORRECTION_SUBJECT;

  constructor(
    private readonly repository: ICorrectionsRepository,
    private readonly approvals: Pick<ApprovalsService, 'route' | 'submit' | 'cancel'>,
    private readonly platform: Deps,
    private readonly settings: CompanySettingsReader,
    private readonly shiftResolver: ShiftResolver | undefined,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  /**
   * Files a correction for one of the caller's own records and opens its approval in the same
   * transaction: either both exist or neither does (D-13).
   */
  async request(
    input: RequestCorrectionInput,
    caller: CorrectionCaller,
  ): Promise<AttendanceCorrection> {
    const now = this.clock();
    const { timezone } = await this.settings.getBasic();
    const checkIn = new Date(input.requestedCheckIn);
    const checkOut = new Date(input.requestedCheckOut);
    const minutes = (checkOut.getTime() - checkIn.getTime()) / 60000;
    if (minutes <= 0) throw unprocessable('The check-out must be after the check-in');
    if (minutes > MAX_CORRECTED_SESSION_MINUTES) {
      throw unprocessable('A corrected session cannot be longer than 24 hours');
    }
    if (checkOut.getTime() > now.getTime()) {
      throw unprocessable('A corrected time cannot be in the future');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    const created = await this.repository.transaction(async (tx) => {
      const record = await this.repository.lockRecord(tx, input.attendanceRecordId);
      // Someone else's record looks exactly like a missing one.
      if (!record || record.employeeId !== caller.employeeId) {
        throw notFound('Attendance record not found');
      }
      if (record.workDate < minusDays(localDate(now, timezone), CORRECTION_WINDOW_DAYS)) {
        throw unprocessable(
          `Only records from the last ${CORRECTION_WINDOW_DAYS} days can be corrected`,
        );
      }
      if (localDate(checkIn, timezone) !== record.workDate) {
        throw unprocessable('The check-in must fall on the record’s work date');
      }
      if (
        await this.repository.hasOverlap(
          tx,
          caller.employeeId,
          record.id,
          input.requestedCheckIn,
          input.requestedCheckOut,
        )
      ) {
        throw conflict('The requested times overlap another attendance session');
      }

      const correction = await this.repository.insert(tx, {
        attendanceRecordId: record.id,
        employeeId: caller.employeeId,
        originalCheckIn: record.checkIn,
        originalCheckOut: record.checkOut,
        requestedCheckIn: checkIn.toISOString(),
        requestedCheckOut: checkOut.toISOString(),
        reason: input.reason,
      });
      const stages = await this.approvals.route(tx, caller.employeeId);
      const approval = await this.approvals.submit(
        tx,
        {
          subjectType: CORRECTION_SUBJECT,
          subjectId: correction.id,
          requesterEmployeeId: caller.employeeId,
          stages,
        },
        events,
      );
      await audit.record(
        {
          action: 'attendance.correction_request',
          outcome: 'success',
          entityType: 'attendance_correction',
          entityId: correction.id,
          metadata: { attendanceRecordId: record.id, workDate: record.workDate },
        },
        { transaction: tx },
      );
      return { ...correction, approvalId: approval.id };
    });
    await events.flush(this.platform.events);
    return created;
  }

  /** The requester withdraws a correction that is still pending. */
  async cancel(id: string, caller: CorrectionCaller): Promise<AttendanceCorrection> {
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    return this.repository.transaction(async (tx) => {
      const existing = await this.repository.find(id, {
        kind: 'own',
        employeeId: caller.employeeId,
      });
      if (!existing) throw notFound('Correction not found');
      // The approval is locked before the correction, the same order a decision uses, so a
      // cancel and a decision at once cannot wait on each other.
      await this.approvals.cancel(tx, CORRECTION_SUBJECT, id);
      const locked = await this.repository.findForUpdate(tx, id);
      if (!locked || locked.status !== 'pending') {
        throw conflict('Only a pending correction can be cancelled');
      }
      await this.repository.setStatus(tx, id, 'cancelled');
      await audit.record(
        {
          action: 'attendance.correction_cancel',
          outcome: 'success',
          entityType: 'attendance_correction',
          entityId: id,
          changes: { status: { from: 'pending', to: 'cancelled' } },
        },
        { transaction: tx },
      );
      return { ...locked, status: 'cancelled' as const };
    });
  }

  /**
   * Called by the approvals engine inside the decision transaction. A rejection only closes the
   * correction. An approval overwrites the record's times, duration and status, so a failure
   * here (for example an overlap that appeared meanwhile) leaves the approval pending.
   */
  async apply(
    tx: ApprovalTx,
    approval: Approval,
    outcome: ApprovalOutcome,
    decider: { employeeId: string; actorId: string; requestId?: string },
  ): Promise<void> {
    const correction = await this.repository.findForUpdate(tx, approval.subjectId);
    if (!correction || correction.status !== 'pending') {
      throw new Error(`Correction ${approval.subjectId} is not pending but its approval is`);
    }
    if (outcome === 'rejected') {
      await this.repository.setStatus(tx, correction.id, 'rejected');
      return;
    }

    const record = await this.repository.lockRecord(tx, correction.attendanceRecordId);
    if (!record) throw new Error(`Attendance record ${correction.attendanceRecordId} vanished`);
    if (
      await this.repository.hasOverlap(
        tx,
        record.employeeId,
        record.id,
        correction.requestedCheckIn,
        correction.requestedCheckOut,
      )
    ) {
      throw conflict(
        'The corrected times now overlap another attendance session; reject the request instead',
      );
    }

    const checkIn = new Date(correction.requestedCheckIn);
    const durationMinutes = Math.round(
      (new Date(correction.requestedCheckOut).getTime() - checkIn.getTime()) / 60000,
    );
    const status = await this.statusFor(record.employeeId, record.workDate, checkIn);
    await this.repository.writeRecordTimes(tx, record.id, {
      checkIn: correction.requestedCheckIn,
      checkOut: correction.requestedCheckOut,
      durationMinutes,
      status,
    });
    await this.repository.setStatus(tx, correction.id, 'approved');
    await this.platform.audit
      .withContext({ actorId: decider.actorId, requestId: decider.requestId })
      .record(
        {
          action: 'attendance.correction_apply',
          outcome: 'success',
          entityType: 'attendance_record',
          entityId: record.id,
          changes: {
            checkInTime: { from: record.checkIn, to: correction.requestedCheckIn },
            checkOutTime: { from: record.checkOut, to: correction.requestedCheckOut },
            durationMinutes: { from: record.durationMinutes, to: durationMinutes },
            status: { from: record.status, to: status },
          },
          metadata: { correctionId: correction.id },
        },
        { transaction: tx },
      );
  }

  async list(
    query: ListCorrectionsQuery,
    caller: CorrectionCaller,
  ): Promise<PaginatedResponse<AttendanceCorrection>> {
    const { items, total } = await this.repository.findMany({
      filter: { kind: 'own', employeeId: caller.employeeId },
      status: query.status,
      ...toOffsetLimit(query),
    });
    return buildPage(items, total, query);
  }

  /**
   * The requester's own correction, or one inside `reviewScope` (the approvers' scope), so an
   * approver can see the times they are asked to decide. Anything else is a 404.
   */
  async get(
    id: string,
    caller: CorrectionCaller,
    reviewScope: ScopeFilter,
  ): Promise<AttendanceCorrection> {
    const own = await this.repository.find(id, { kind: 'own', employeeId: caller.employeeId });
    const found = own ?? (await this.repository.find(id, reviewScope));
    if (!found) throw notFound('Correction not found');
    return found;
  }

  private async statusFor(employeeId: string, workDate: string, checkIn: Date): Promise<string> {
    if (!this.shiftResolver) return 'present';
    const [shift, { timezone }] = await Promise.all([
      this.shiftResolver.shiftOn(employeeId, workDate),
      this.settings.getBasic(),
    ]);
    return checkInStatus(shift, checkIn, timezone);
  }
}
