import { ROLES, type Role } from '@maxr/shared';
import { AuthUser } from './types';

export interface MockUser extends AuthUser {
  userId: string;
  teamId?: string;
}

export const MOCK_USERS: Record<Role, MockUser> = {
  [ROLES.ADMIN]: {
    id: 'usr-admin-001',
    userId: 'usr-admin-001',
    employeeId: 'emp-001',
    role: ROLES.ADMIN,
    roles: [ROLES.ADMIN],
    permissions: [],
    email: 'admin@maxr.internal',
    name: 'Admin',
    title: 'System Administrator',
    department: 'HR Department',
    avatarInitials: 'AD',
  },
  [ROLES.HR_MANAGER]: {
    id: 'usr-hr-002',
    userId: 'usr-hr-002',
    employeeId: 'emp-002',
    role: ROLES.HR_MANAGER,
    roles: [ROLES.HR_MANAGER],
    permissions: [],
    email: 'shajitha@maxr.internal',
    name: 'Shajitha',
    title: 'HR Manager',
    department: 'HR Department',
    avatarInitials: 'SH',
  },
  [ROLES.TEAM_LEAD]: {
    id: 'usr-lead-003',
    userId: 'usr-lead-003',
    employeeId: 'emp-003',
    role: ROLES.TEAM_LEAD,
    roles: [ROLES.TEAM_LEAD],
    permissions: [],
    teamId: 'team-ai-core',
    email: 'teamlead@maxr.internal',
    name: 'Marcus Vance',
    title: 'Lead AI Engineer',
    department: 'AI Department',
    avatarInitials: 'MV',
  },
  [ROLES.STAFF]: {
    id: 'usr-staff-004',
    userId: 'usr-staff-004',
    employeeId: 'emp-004',
    role: ROLES.STAFF,
    roles: [ROLES.STAFF],
    permissions: [],
    email: 'arunkumar@maxr.internal',
    name: 'Arunkumar',
    title: 'AI Intern',
    department: 'AI Department',
    avatarInitials: 'AK',
  },
};
