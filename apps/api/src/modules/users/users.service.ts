import { PaginatedResponse, Role } from '@maxr/shared';
import { notFound, unprocessable } from '../../http/errors';
import { buildPage, toOffsetLimit } from '../../http/pagination';
import type { PlatformServices } from '../../platform';
import { PERMISSION_CATALOG, PERMISSION_KEYS } from '../rbac';
import { RequestContext } from '../employees/types';
import { IUsersRepository } from './users.repository';
import { RoleSummary, UserAccount, UserFilters, UserSortField } from './users.types';

export interface UserListQuery extends UserFilters {
  page: number;
  pageSize: number;
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
}

export interface PermissionSummary {
  key: string;
  module: string;
  action: string;
  description: string;
  /** Role -> record scope. A role that is absent does not hold the permission. */
  grants: Record<string, string>;
}

type Deps = Pick<PlatformServices, 'audit'>;

export class UsersService {
  constructor(
    private readonly repository: IUsersRepository,
    private readonly platform: Deps,
  ) {}

  async list(query: UserListQuery): Promise<PaginatedResponse<UserAccount>> {
    const { page, pageSize, ...rest } = query;
    const { items, total } = await this.repository.findMany({
      ...rest,
      ...toOffsetLimit({ page, pageSize }),
    });
    return buildPage(items, total, { page, pageSize });
  }

  async get(id: string): Promise<UserAccount> {
    const user = await this.repository.findById(id);
    if (!user) throw notFound('User not found');
    return user;
  }

  listRoles(): Promise<RoleSummary[]> {
    return this.repository.listRoles();
  }

  /** The catalog in code is the authority (D-21); the database rows only mirror it. */
  listPermissions(): PermissionSummary[] {
    return PERMISSION_KEYS.map((key) => {
      const [module = key, ...rest] = key.split('.');
      return {
        key,
        module,
        action: rest.join('.'),
        description: PERMISSION_CATALOG[key].description,
        grants: { ...PERMISSION_CATALOG[key].grants },
      };
    });
  }

  async replaceRoles(
    id: string,
    roles: readonly Role[],
    ctx: RequestContext,
  ): Promise<UserAccount> {
    const audit = this.platform.audit.withContext(ctx);
    try {
      const result = await this.repository.replaceRoles(id, roles);
      switch (result.status) {
        case 'not_found':
          throw notFound('User not found');
        case 'last_admin':
          throw unprocessable('The last active Admin cannot lose the Admin role');
        case 'unchanged':
          return result.user;
        case 'changed':
          await audit.record({
            action: 'users.assign_role',
            outcome: 'success',
            entityType: 'user',
            entityId: id,
            changes: { roles: { from: result.before, to: result.user.roles } },
          });
          return result.user;
      }
    } catch (err) {
      await audit.tryRecord({
        action: 'users.assign_role',
        outcome: 'failure',
        entityType: 'user',
        entityId: id,
        metadata: { requestedRoles: roles },
      });
      throw err;
    }
  }
}
