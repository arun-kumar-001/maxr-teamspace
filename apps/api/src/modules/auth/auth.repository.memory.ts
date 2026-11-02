import { AuthRepository, AuthUser, FailureWindow } from './auth.types';

interface Attempt {
  identifier: string;
  ip: string;
  success: boolean;
  at: Date;
}

/** For tests: the same behaviour as the SQL repository, without a database. */
export class InMemoryAuthRepository implements AuthRepository {
  readonly users = new Map<string, AuthUser>();
  readonly attempts: Attempt[] = [];
  readonly lastLogin = new Map<string, Date>();

  /** `ready` lets a test kit finish hashing its users' passwords before the first lookup. */
  constructor(
    private readonly now: () => Date = () => new Date(),
    private readonly ready: Promise<unknown> = Promise.resolve(),
  ) {}

  async findUserByEmail(email: string): Promise<AuthUser | null> {
    await this.ready;
    const wanted = email.toLowerCase();
    return [...this.users.values()].find((u) => u.email.toLowerCase() === wanted) ?? null;
  }

  async findUserById(id: string): Promise<AuthUser | null> {
    await this.ready;
    return this.users.get(id) ?? null;
  }

  async recordLoginAttempt(attempt: {
    identifier: string;
    ip: string;
    success: boolean;
  }): Promise<void> {
    this.attempts.push({ ...attempt, at: this.now() });
  }

  async recentFailures(identifier: string, since: Date): Promise<FailureWindow> {
    const mine = this.attempts.filter((a) => a.identifier === identifier);
    const lastSuccess = mine
      .filter((a) => a.success)
      .reduce<Date | null>((latest, a) => (!latest || a.at > latest ? a.at : latest), null);
    const floor = lastSuccess && lastSuccess > since ? lastSuccess : since;
    const failures = mine.filter((a) => !a.success && a.at > floor);
    const oldestAt = failures.reduce<Date | null>(
      (oldest, a) => (!oldest || a.at < oldest ? a.at : oldest),
      null,
    );
    return { count: failures.length, oldestAt };
  }

  async touchLastLogin(userId: string, at: Date): Promise<void> {
    this.lastLogin.set(userId, at);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.passwordHash = passwordHash;
  }
}
