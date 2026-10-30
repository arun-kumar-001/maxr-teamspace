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
}
