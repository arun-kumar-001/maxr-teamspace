import { randomBytes } from 'node:crypto';
import { ROLES, type Role } from '@maxr/shared';
import { conflict, forbidden, unprocessable } from '../../../http/errors';
import { Logger, getLogger } from '../../../logging/logger';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import type { PasswordHasher } from '../../auth/password-hasher';
import { IEmployeeCreationRepository } from './creation.repository';
import { CreateEmployeeDto, CreatedEmployee, ReferenceRows } from './creation.types';

type Deps = Pick<PlatformServices, 'audit' | 'events' | 'notifications'>;

/** Who is calling, taken from the session by the route, never from the body. */
export interface CreationCaller {
  actorId: string;
  roles: readonly Role[];
  requestId?: string;
}

/** Roles that widen access. Handing them out is an Admin decision, not an HR one. */
const ADMIN_ONLY_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.HR_MANAGER];

function referenceProblems(dto: CreateEmployeeDto, refs: ReferenceRows) {
  const problems: Array<{ field: string; message: string }> = [];
  if (!refs.department) problems.push({ field: 'departmentId', message: 'Department not found' });
  else if (!refs.department.isActive)
    problems.push({ field: 'departmentId', message: 'Department is not active' });

  if (!refs.designation)
    problems.push({ field: 'designationId', message: 'Designation not found' });
  else if (!refs.designation.isActive)
    problems.push({ field: 'designationId', message: 'Designation is not active' });
  else if (refs.designation.departmentId !== dto.departmentId)
    problems.push({
      field: 'designationId',
      message: 'Designation does not belong to the department',
    });

  if (dto.managerId) {
    if (!refs.manager) problems.push({ field: 'managerId', message: 'Manager not found' });
    else if (refs.manager.status !== 'active')
      problems.push({ field: 'managerId', message: 'Manager is not an active employee' });
  }
  return problems;
}

export class EmployeeCreationService {
  constructor(
    private readonly repository: IEmployeeCreationRepository,
    private readonly platform: Deps,
    private readonly hasher: PasswordHasher,
    private readonly logger: Logger = getLogger(),
  ) {}

  /**
   * Employee, sign-in account and role in one transaction, with the audit entry. The account is
   * created inactive (employee status `pending`) and with a password nobody knows: the employee
   * gets in through the onboarding flow (D-20, #24). The welcome email is queued only after
   * the commit, so a rolled-back creation never emails anyone.
   */
  async create(dto: CreateEmployeeDto, caller: CreationCaller): Promise<CreatedEmployee> {
    if (ADMIN_ONLY_ROLES.includes(dto.role) && !caller.roles.includes(ROLES.ADMIN)) {
      throw forbidden('Only an Admin can create an account with this role');
    }
    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    // Outside the transaction: hashing is slow and needs no database.
    const unusableHash = await this.hasher.hash(randomBytes(32).toString('base64url'));
    try {
      const created = await this.repository.transaction(async (tx) => {
        const problems = referenceProblems(dto, await this.repository.lockReferences(tx, dto));
        if (problems.length > 0) {
          throw unprocessable('The department, designation or manager is not usable', problems);
        }
        const existing = await this.repository.findExisting(tx, dto.employeeCode, dto.email);
        if (existing.employeeCode) throw conflict('An employee with this code already exists');
        if (existing.email) throw conflict('An employee or account with this email already exists');

        const account = await this.repository.insertAccount(tx, dto, unusableHash);
        // Ids and the code only: names and email are personal data and stay out of the trail.
        await audit.record(
          {
            action: 'employee.create',
            outcome: 'success',
            entityType: 'employee',
            entityId: account.id,
            changes: {
              employeeCode: account.employeeCode,
              role: account.role,
              departmentId: account.departmentId,
              designationId: account.designationId,
              managerId: account.managerId,
              status: account.status,
            },
          },
          { transaction: tx },
        );
        return account;
      });

      events.add({
        type: 'employee.created',
        payload: { employeeId: created.id, userId: created.userId, role: created.role },
        actorId: caller.actorId,
        requestId: caller.requestId,
      });
      await events.flush(this.platform.events);
      await this.queueWelcomeEmail(created);
      return created;
    } catch (err) {
      await audit.tryRecord({
        action: 'employee.create',
        outcome: 'failure',
        entityType: 'employee',
      });
      throw err;
    }
  }

  /**
   * After the commit. A failure here must not undo or fail a creation that already happened:
   * it is logged, and the same dedupe key makes a later resend safe.
   */
  private async queueWelcomeEmail(created: CreatedEmployee): Promise<void> {
    try {
      await this.platform.notifications.enqueueEmail({
        to: [created.email],
        subject: 'Welcome to MAXR Teamspace',
        text:
          `Hello ${created.firstName},\n\n` +
          'An account has been created for you on MAXR Teamspace. ' +
          'You will receive a separate message with a link to set your password ' +
          'once your onboarding has been completed.\n',
        dedupeKey: `employee:${created.id}:welcome`,
      });
    } catch (err) {
      this.logger.error('welcome email could not be queued', {
        employeeId: created.id,
        err,
      });
    }
  }
}
