import { ROLES, type Role } from '@maxr/shared';
import { IUsersRepository } from './users.repository';
import { ReplaceRolesResult, RoleSummary, UserAccount, UserFindManyParams } from './users.types';

/** In-memory accounts for unit and HTTP tests (not shipped in the build). */
export class MemoryUsersRepository implements IUsersRepository {
  constructor(
    public users: UserAccount[] = [],
    private readonly roleSummaries: RoleSummary[] = [],
  ) {}

  async findMany(p: UserFindManyParams) {
    const needle = p.search?.toLowerCase();
    const matching = this.users.filter(
      (u) =>
        (!needle ||
          [u.name, u.email, u.employeeCode].some((value) =>
            value.toLowerCase().includes(needle),
          )) &&
        (p.isActive === undefined || u.isActive === p.isActive) &&
        (!p.role || u.roles.includes(p.role)),
    );
    const key = (u: UserAccount): string =>
      p.sortBy === 'email'
        ? u.email.toLowerCase()
        : p.sortBy === 'createdAt'
          ? u.createdAt
          : p.sortBy === 'lastLoginAt'
            ? (u.lastLoginAt ?? '')
            : u.name.toLowerCase();
    const direction = p.sortOrder === 'asc' ? 1 : -1;
    matching.sort((a, b) => (key(a).localeCompare(key(b)) || a.id.localeCompare(b.id)) * direction);
    return { items: matching.slice(p.offset, p.offset + p.limit), total: matching.length };
  }

  async findById(id: string): Promise<UserAccount | null> {
    return this.users.find((u) => u.id === id) ?? null;
  }

  async listRoles(): Promise<RoleSummary[]> {
    return this.roleSummaries;
  }

  async replaceRoles(userId: string, roles: readonly Role[]): Promise<ReplaceRolesResult> {
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { status: 'not_found' };
    const before = [...user.roles].sort();
    const after = [...roles].sort();
    if (before.join() === after.join()) return { status: 'unchanged', user };
    const otherAdmins = this.users.filter(
      (u) => u.id !== userId && u.isActive && u.roles.includes(ROLES.ADMIN),
    );
    if (
      user.isActive &&
      before.includes(ROLES.ADMIN) &&
      !after.includes(ROLES.ADMIN) &&
      otherAdmins.length === 0
    ) {
      return { status: 'last_admin' };
    }
    user.roles = after;
    return { status: 'changed', user, before: before as Role[] };
  }
}
