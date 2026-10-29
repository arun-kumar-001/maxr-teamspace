import { ROLES, type Role } from '@maxr/shared';

export interface MockUser {
  userId: string;
  employeeId: string;
  role: Role;
  email: string;
  name: string;
  title: string;
  department: string;
  avatarInitials: string;
  teamId?: string;
}

export const MOCK_USERS: Record<Role, MockUser> = {
  [ROLES.ADMIN]: {
    userId: 'usr-admin-001',
    employeeId: 'emp-001',
    role: ROLES.ADMIN,
    email: 'admin@maxr.com',
    name: 'Sarah Connor',
    title: 'System Administrator',
    department: 'Information Technology',
    avatarInitials: 'SC',
  },
  [ROLES.HR_MANAGER]: {
    userId: 'usr-hr-002',
    employeeId: 'emp-002',
    role: ROLES.HR_MANAGER,
    email: 'hr@maxr.com',
    name: 'Elena Rostova',
    title: 'Head of People Operations',
    department: 'Human Resources',
    avatarInitials: 'ER',
  },
  [ROLES.TEAM_LEAD]: {
    userId: 'usr-lead-003',
    employeeId: 'emp-003',
    role: ROLES.TEAM_LEAD,
    teamId: 'team-eng-core',
    email: 'lead@maxr.com',
    name: 'Marcus Vance',
    title: 'Engineering Lead',
    department: 'Engineering',
    avatarInitials: 'MV',
  },
  [ROLES.STAFF]: {
    userId: 'usr-staff-004',
    employeeId: 'emp-004',
    role: ROLES.STAFF,
    teamId: 'team-eng-core',
    email: 'staff@maxr.com',
    name: 'Alex Mercer',
    title: 'Software Engineer',
    department: 'Engineering',
    avatarInitials: 'AM',
  },
};
