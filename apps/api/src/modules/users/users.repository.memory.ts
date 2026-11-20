import { randomUUID } from 'node:crypto';
import { ROLES, type Role } from '@maxr/shared';
import { IUsersRepository } from './users.repository';
import {
  CreateUserInput,
  CreateUserResult,
  ReplaceRolesResult,
  RoleSummary,
  UpdateUserStatusResult,
  UserAccount,
  UserFindManyParams,
} from './users.types';

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

  async createUser(input: CreateUserInput): Promise<CreateUserResult> {
    const email = input.email.trim().toLowerCase();
    if (this.users.some((u) => u.email.toLowerCase() === email)) {
      return { status: 'duplicate_email' };
    }
    const created: UserAccount = {
      id: randomUUID(),
      employeeId: randomUUID(),
      employeeCode: `USR-${String(this.users.length + 1).padStart(4, '0')}`,
      name: `${input.firstName} ${input.lastName}`.trim(),
      email,
      isActive: input.isActive ?? true,
      roles: [...input.roles].sort(),
      lastLoginAt: null,
      createdAt: new Date().toISOString(),
    };
    this.users.push(created);
    return { status: 'created', user: created };
  }

  async setStatus(
    userId: string,
    isActive: boolean,
    actorUserId: string,
  ): Promise<UpdateUserStatusResult> {
    if (!isActive && userId === actorUserId) {
      return { status: 'self_deactivate' };
    }
    const user = this.users.find((u) => u.id === userId);
    if (!user) return { status: 'not_found' };
    if (user.isActive === isActive) return { status: 'unchanged', user };
    const otherAdmins = this.users.filter(
      (u) => u.id !== userId && u.isActive && u.roles.includes(ROLES.ADMIN),
    );
    if (!isActive && user.roles.includes(ROLES.ADMIN) && otherAdmins.length === 0) {
      return { status: 'last_admin' };
    }
    const before = user.isActive;
    user.isActive = isActive;
    return { status: 'changed', user, before };
  }
}
