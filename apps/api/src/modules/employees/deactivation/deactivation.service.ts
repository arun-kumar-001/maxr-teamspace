import { notFound, unprocessable } from '../../../http/errors';
import { Logger, getLogger } from '../../../logging/logger';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import { IDeactivationRepository } from './deactivation.repository';
import { DeactivationResult, DirectReport, SessionRevoker } from './deactivation.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** Who is calling, taken from the session by the route, never from the body. */
export interface DeactivationCaller {
  actorId: string;
  employeeId: string;
  requestId?: string;
}

export class EmployeeDeactivationService {
  constructor(
    private readonly repository: IDeactivationRepository,
    private readonly platform: Deps,
    private readonly sessions: SessionRevoker,
    private readonly logger: Logger = getLogger(),
  ) {}

  /**
   * Deactivates the employee and their sign-in account now, then ends every session they have.
   *
   * Nothing is deleted: history and audit stay. The account is rejected on its very next request
   * because sign-in state is read from the database each time; ending the sessions is clean-up and
   * a second line of defence, and runs again on a repeat call. Calling it for an employee who is
   * already deactivated changes and audits nothing, and answers 200.
   */
  async deactivate(employeeId: string, caller: DeactivationCaller): Promise<DeactivationResult> {
    if (employeeId === caller.employeeId) {
      throw unprocessable('You cannot deactivate your own account. Ask another Admin');
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    try {
      const outcome = await this.repository.transaction(async (tx) => {
        // Same lock order as role assignment (Admin role, then the rows), so they cannot deadlock.
        await this.repository.lockAdminRole(tx);
        const target = await this.repository.lockTarget(tx, employeeId);
        if (!target) throw notFound('Employee not found');

        if (target.status === 'deactivated') {
          const record = await this.repository.readRecord(tx, employeeId);
          const directReports = await this.repository.listDirectReports(tx, employeeId);
          return { target, record, directReports, changed: false };
        }

        if (target.userId && target.userActive && target.holdsAdminRole) {
          const others = await this.repository.countOtherActiveAdmins(tx, target.userId);
          if (others === 0) {
            throw unprocessable('The last active Admin cannot be deactivated');
          }
        }

        const record = await this.repository.deactivate(tx, target);
        const directReports = await this.repository.listDirectReports(tx, employeeId);
        await audit.record(
          {
            action: 'employee.deactivate',
            outcome: 'success',
            entityType: 'employee',
            entityId: employeeId,
            changes: { status: { from: target.status, to: 'deactivated' } },
            metadata: { directReports: directReports.length },
          },
          { transaction: tx },
        );
        events.add({
          type: 'employee.deactivated',
          payload: {
            employeeId,
            userId: target.userId,
            directReportIds: directReports.map((r) => r.id),
          },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
        return { target, record, directReports, changed: true };
      });

      await events.flush(this.platform.events);
      const sessionsRevoked = await this.endSessions(outcome.target.userId, employeeId, audit);
      return this.result(employeeId, outcome, sessionsRevoked);
    } catch (err) {
      await audit.tryRecord({
        action: 'employee.deactivate',
        outcome: 'failure',
        entityType: 'employee',
        entityId: employeeId,
      });
      throw err;
    }
  }

  /**
   * After the commit. The account is already refused at the door, so a failure here is logged, not
   * returned: the caller repeats the request to retry the clean-up.
   */
  private async endSessions(
    userId: string | null,
    employeeId: string,
    audit: Deps['audit'],
  ): Promise<number> {
    if (!userId) return 0;
    try {
      const count = await this.sessions.revokeAllForUser(userId);
      if (count > 0) {
        await audit.tryRecord({
          action: 'session.revoke_all',
          outcome: 'success',
          entityType: 'employee',
          entityId: employeeId,
          metadata: { reason: 'deactivation', sessions: count },
        });
      }
      return count;
    } catch (err) {
      this.logger.error('sessions could not be ended after a deactivation', { employeeId, err });
      return 0;
    }
  }

  private result(
    employeeId: string,
    outcome: {
      record: { deactivatedAt: string; version: number };
      directReports: DirectReport[];
      changed: boolean;
    },
    sessionsRevoked: number,
  ): DeactivationResult {
    return {
      id: employeeId,
      status: 'deactivated',
      deactivatedAt: outcome.record.deactivatedAt,
      version: outcome.record.version,
      alreadyDeactivated: !outcome.changed,
      sessionsRevoked,
      directReports: outcome.directReports,
    };
  }
}
