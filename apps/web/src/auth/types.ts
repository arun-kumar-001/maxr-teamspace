import { Role } from '@maxr/shared';

export interface AuthUser {
  id: string;
  employeeId?: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  role: Role;
  roles: Role[];
  permissions: string[];
  title?: string;
  department?: string;
  avatarInitials: string;
  avatarUrl?: string;
  /** A password someone else set must be replaced before anything else can be used. */
  mustChangePassword?: boolean;
}
