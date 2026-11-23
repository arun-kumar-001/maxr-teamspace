import type { Role } from '@maxr/shared';
import { EmployeeDetailService } from '../detail/detail.service';
import { EmployeeDetail } from '../detail/detail.types';

export interface ProfileCaller {
  actorId: string;
  employeeId: string;
  roles: readonly Role[];
  requestId?: string;
}

/**
 * The caller's own record. It reuses the employee detail service with a scope that is the caller
 * and nobody else, so concurrency, audit and validation are the same code as an HR edit, and
 * there is no id in the request that could point at another employee.
 */
export class ProfileService {
  constructor(private readonly details: EmployeeDetailService) {}

  private own(caller: ProfileCaller) {
    return { kind: 'own', employeeId: caller.employeeId } as const;
  }

  get(caller: ProfileCaller): Promise<EmployeeDetail> {
    return this.details.get(caller.employeeId, this.own(caller), caller);
  }

  update(
    dto: { version: number; phone: string | null },
    caller: ProfileCaller,
  ): Promise<EmployeeDetail> {
    return this.details.update(caller.employeeId, dto, caller, this.own(caller));
  }
}
