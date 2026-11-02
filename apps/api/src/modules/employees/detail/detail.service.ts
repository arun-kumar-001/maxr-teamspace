import { ROLES, type Role } from '@maxr/shared';
import { conflict, forbidden, notFound, unprocessable } from '../../../http/errors';
import type { PlatformServices } from '../../../platform';
import { EventCollector } from '../../../platform/events/event-bus';
import { ScopeFilter, resolveScope, scopeAllows } from '../../rbac';
import { referenceProblems } from '../references';
import { IEmployeeDetailRepository } from './detail.repository';
import { EmployeeDetail, EmployeePatch, PatchField } from './detail.types';

type Deps = Pick<PlatformServices, 'audit' | 'events'>;

/** Who is calling, taken from the session by the route, never from the body. */
export interface DetailCaller {
  actorId: string;
  roles: readonly Role[];
  requestId?: string;
}

/**
 * Identity fields. Changing them touches sign-in (the email) or how an employee is referred to
 * everywhere (the code), so HR, who can edit the rest, cannot.
 */
const ADMIN_ONLY_FIELDS: readonly PatchField[] = ['employeeCode', 'email'];

const sameValue = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

export class EmployeeDetailService {
  constructor(
    private readonly repository: IEmployeeDetailRepository,
    private readonly platform: Deps,
  ) {}

  /** Login information is shown only to callers who may edit employees. */
  private mayEdit(caller: DetailCaller): boolean {
    return resolveScope(caller.roles, 'employees.update') !== null;
  }

  async get(id: string, filter: ScopeFilter, caller: DetailCaller): Promise<EmployeeDetail> {
    const found = await this.repository.findById(id, filter, this.mayEdit(caller));
    if (!found) throw notFound('Employee not found');
    return found;
  }

  /**
   * Changes the given fields of one employee. Under a row lock, in one transaction: scope, status
   * and version are checked, department/designation are validated together, then the change and the
   * audit entry are written. Nothing is written when no value actually changes.
   */
  async update(
    id: string,
    dto: EmployeePatch & { version: number },
    caller: DetailCaller,
    filter: ScopeFilter,
  ): Promise<EmployeeDetail> {
    const { version, ...patch } = dto;
    const requested = Object.keys(patch) as PatchField[];
    if (
      requested.some((field) => ADMIN_ONLY_FIELDS.includes(field)) &&
      !caller.roles.includes(ROLES.ADMIN)
    ) {
      throw forbidden('Only an Admin can change the employee code or the email');
    }

    const audit = this.platform.audit.withContext({
      actorId: caller.actorId,
      requestId: caller.requestId,
    });
    const events = new EventCollector();
    try {
      const updated = await this.repository.transaction(async (tx) => {
        const current = await this.repository.lockEditable(tx, id);
        // Out of scope looks exactly like missing.
        if (!current || !scopeAllows(filter, current.id, current.managerId)) {
          throw notFound('Employee not found');
        }
        if (current.status === 'deactivated') {
          throw unprocessable('A deactivated employee cannot be edited');
        }
        if (current.version !== version) {
          throw conflict('This employee was changed by someone else. Reload and try again');
        }

        const changed = requested.filter((field) => !sameValue(patch[field], current[field]));
        if (changed.length === 0) return this.repository.load(tx, id, this.mayEdit(caller));

        const departmentId = patch.departmentId ?? current.departmentId;
        const designationId = patch.designationId ?? current.designationId;
        if (changed.includes('departmentId') || changed.includes('designationId')) {
          const refs = await this.repository.lockReferences(tx, { departmentId, designationId });
          const problems = referenceProblems({ departmentId, designationId }, refs);
          if (problems.length > 0) {
            throw unprocessable('The department or designation is not usable', problems);
          }
        }
        const taken = await this.repository.isTaken(
          tx,
          {
            employeeCode: changed.includes('employeeCode') ? patch.employeeCode : undefined,
            email: changed.includes('email') ? patch.email : undefined,
          },
          id,
        );
        if (taken.employeeCode) throw conflict('An employee with this code already exists');
        if (taken.email) throw conflict('An employee or account with this email already exists');

        const applied: EmployeePatch = {};
        for (const field of changed) Object.assign(applied, { [field]: patch[field] });
        await this.repository.applyPatch(tx, id, applied);

        // Names, email and phone are personal data: the trail records which fields changed, and the
        // ids of a new department or designation.
        await audit.record(
          {
            action: 'employee.update',
            outcome: 'success',
            entityType: 'employee',
            entityId: id,
            changes: {
              fields: changed,
              ...(changed.includes('departmentId')
                ? { departmentId: { from: current.departmentId, to: departmentId } }
                : {}),
              ...(changed.includes('designationId')
                ? { designationId: { from: current.designationId, to: designationId } }
                : {}),
            },
          },
          { transaction: tx },
        );
        events.add({
          type: 'employee.updated',
          payload: { employeeId: id, fields: changed },
          actorId: caller.actorId,
          requestId: caller.requestId,
        });
        return this.repository.load(tx, id, this.mayEdit(caller));
      });
      await events.flush(this.platform.events);
      return updated;
    } catch (err) {
      await audit.tryRecord({
        action: 'employee.update',
        outcome: 'failure',
        entityType: 'employee',
        entityId: id,
      });
      throw err;
    }
  }
}
