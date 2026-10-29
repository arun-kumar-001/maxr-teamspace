import { ERROR_CODES, ROLES, type Role } from '@maxr/shared';
import { AppError } from '../../http/app-error';
import { forbidden, unauthorized, unprocessable } from '../../http/errors';
import type { AuditLogger } from '../../platform';
import { AuthConfig } from './auth-config';
import { AuthRepository, AuthUser, Profile, RequestMeta } from './auth.types';
import { PasswordHasher } from './password-hasher';
import { IssuedSession, SessionService } from './session-service';

/** A 429 that also tells the controller when to retry. */
export class LoginLockedError extends AppError {
  constructor(readonly retryAfterSeconds: number) {
    super(429, ERROR_CODES.RATE_LIMITED, 'Too many failed sign-in attempts. Try again later.');
    this.name = 'LoginLockedError';
  }
}

export interface LoginResult {
  profile: Profile;
  session: IssuedSession;
}

// Obviously guessable passwords that meet the length rule. A real breached-password check is a later hardening step (#16).
const COMMON_PASSWORDS = new Set([
  'password1234',
  'password123!',
  'passw0rd1234',
  'qwerty123456',
  '123456789012',
  'welcome12345',
  'letmein12345',
  'changeme1234',
  'administrator',
  'iloveyou1234',
]);

/** Highest privilege first: the role shown and used for the UI when a user has several. */
const ROLE_PRECEDENCE: Role[] = [ROLES.ADMIN, ROLES.HR_MANAGER, ROLES.TEAM_LEAD, ROLES.STAFF];

const isRole = (value: string): value is Role => (ROLE_PRECEDENCE as string[]).includes(value);

export const toRoles = (keys: string[]): Role[] =>
  ROLE_PRECEDENCE.filter((role) => keys.includes(role));

export class AuthService {
  constructor(
    private readonly repo: AuthRepository,
    private readonly sessions: SessionService,
    private readonly hasher: PasswordHasher,
    private readonly dummyHash: () => Promise<string>,
    private readonly audit: AuditLogger,
    private readonly config: AuthConfig,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async login(input: { email: string; password: string }, meta: RequestMeta): Promise<LoginResult> {
    const identifier = input.email.trim().toLowerCase();
    const audit = this.audit.withContext({ requestId: meta.requestId });

    const failures = await this.repo.recentFailures(
      identifier,
      new Date(this.now().getTime() - this.config.lockoutWindowMs),
    );
    if (failures.count >= this.config.maxLoginFailures) {
      const unlockAt = (failures.oldestAt ?? this.now()).getTime() + this.config.lockoutWindowMs;
      await audit.record({
        action: 'auth.login_failed',
        outcome: 'denied',
        entityType: 'user',
        metadata: { reason: 'locked', ip: meta.ip },
      });
      throw new LoginLockedError(Math.max(1, Math.ceil((unlockAt - this.now().getTime()) / 1000)));
    }

    const user = await this.repo.findUserByEmail(identifier);
    // Always verify something, so an unknown email costs the same time as a wrong password.
    const passwordOk = await this.hasher.verify(
      user?.passwordHash ?? (await this.dummyHash()),
      input.password,
    );
    const reason = this.rejectionReason(user, passwordOk);

    if (reason || !user) {
      await this.repo.recordLoginAttempt({ identifier, ip: meta.ip, success: false });
      await audit.record({
        action: 'auth.login_failed',
        outcome: 'failure',
        entityType: 'user',
        entityId: user?.id,
        metadata: { reason: reason ?? 'unknown_user', ip: meta.ip },
      });
      // One message for every reason, so the response does not reveal which emails exist.
      throw unauthorized('Invalid email or password');
    }

    await this.repo.recordLoginAttempt({ identifier, ip: meta.ip, success: true });
    await this.repo.touchLastLogin(user.id, this.now());
    const session = await this.sessions.create(user.id);
    try {
      await audit.record({
        action: 'auth.login',
        outcome: 'success',
        entityType: 'user',
        entityId: user.id,
        actorId: user.id,
        actorRole: toRoles(user.roles)[0],
        metadata: { ip: meta.ip },
      });
    } catch (error) {
      // Audit fails closed: no recorded sign-in, no session.
      await this.sessions.revokeAllForUser(user.id);
      throw error;
    }
    return { profile: await this.profileOf(user), session };
  }

  async logout(userId: string, tokenHash: string, role: Role, meta: RequestMeta): Promise<void> {
    await this.sessions.revoke(tokenHash);
    await this.audit
      .withContext({ requestId: meta.requestId, actorId: userId, actorRole: role })
      .record({
        action: 'auth.logout',
        outcome: 'success',
        entityType: 'user',
        entityId: userId,
      });
  }

  async me(userId: string): Promise<Profile> {
    const user = await this.repo.findUserById(userId);
    if (!user || !this.isUsable(user)) throw unauthorized();
    return this.profileOf(user);
  }

  async changePassword(
    userId: string,
    currentTokenHash: string,
    input: { currentPassword: string; newPassword: string },
    meta: RequestMeta,
  ): Promise<void> {
    const user = await this.repo.findUserById(userId);
    if (!user || !this.isUsable(user)) throw unauthorized();
    const audit = this.audit.withContext({
      requestId: meta.requestId,
      actorId: user.id,
      actorRole: toRoles(user.roles)[0],
    });

    if (!(await this.hasher.verify(user.passwordHash, input.currentPassword))) {
      await audit.record({
        action: 'auth.password_change_failed',
        outcome: 'failure',
        entityType: 'user',
        entityId: user.id,
        metadata: { reason: 'wrong_current_password' },
      });
      throw forbidden('The current password is incorrect');
    }

    const problem = this.passwordProblem(input.newPassword, input.currentPassword, user.email);
    if (problem) throw unprocessable(problem, [{ field: 'newPassword', message: problem }]);

    await this.repo.updatePasswordHash(user.id, await this.hasher.hash(input.newPassword));
    // Anyone holding the old password loses their session; this one stays signed in.
    const ended = await this.sessions.revokeAllForUser(user.id, currentTokenHash);
    await audit.record({
      action: 'auth.password_changed',
      outcome: 'success',
      entityType: 'user',
      entityId: user.id,
      metadata: { otherSessionsEnded: ended },
    });
  }

  private rejectionReason(user: AuthUser | null, passwordOk: boolean): string | null {
    if (!user) return 'unknown_user';
    if (!passwordOk) return 'bad_password';
    if (!user.isActive) return 'inactive';
    if (user.employeeStatus !== 'active') return 'employee_not_active';
    if (toRoles(user.roles).length === 0) return 'no_role';
    return null;
  }

  private isUsable(user: AuthUser): boolean {
    return this.rejectionReason(user, true) === null;
  }

  private passwordProblem(password: string, current: string, email: string): string | null {
    if (password.length < this.config.minPasswordLength) {
      return `The new password must be at least ${this.config.minPasswordLength} characters`;
    }
    if (password.length > this.config.maxPasswordLength) {
      return `The new password must be at most ${this.config.maxPasswordLength} characters`;
    }
    if (password === current) return 'The new password must be different from the current one';
    const lower = password.toLowerCase();
    if (lower === email.toLowerCase() || COMMON_PASSWORDS.has(lower)) {
      return 'The new password is too easy to guess';
    }
    return null;
  }

  private async profileOf(user: AuthUser): Promise<Profile> {
    const roles = toRoles(user.roles.filter(isRole));
    return {
      id: user.id,
      employeeId: user.employeeId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: roles[0] as Role,
      roles,
      permissions: await this.repo.getPermissionKeys(roles),
    };
  }
}
