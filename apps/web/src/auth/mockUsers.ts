import { ROLES, type Role } from '@maxr/shared';
import { DEMO_USER_EMPLOYEE_IDS } from '@/lib/demo-ids';
import { AuthUser } from './types';

export interface MockUser extends AuthUser {
  userId: string;
  teamId?: string;
}

export const MOCK_USERS: Record<Role, MockUser> = {
  [ROLES.ADMIN]: {
    id: 'usr-admin-001',
    userId: 'usr-admin-001',
    employeeId: DEMO_USER_EMPLOYEE_IDS.admin,
    role: ROLES.ADMIN,
    roles: [ROLES.ADMIN],
    permissions: [],
    email: 'admin@maxr.internal',
    name: 'Shagul Hamithu',
    title: 'System Administrator',
    department: 'Administration',
    avatarInitials: 'SH',
    avatarUrl: '/user-portrait.png',
  },
  [ROLES.HR_MANAGER]: {
    id: 'usr-hr-002',
    userId: 'usr-hr-002',
    employeeId: DEMO_USER_EMPLOYEE_IDS.hr_manager,
    role: ROLES.HR_MANAGER,
    roles: [ROLES.HR_MANAGER],
    permissions: [],
    email: 'shajitha@maxr.internal',
    name: 'Shajitha',
    title: 'HR Manager',
    department: 'HR Department',
    avatarInitials: 'SH',
    avatarUrl: '/user-portrait.png',
  },
  [ROLES.TEAM_LEAD]: {
    id: 'usr-lead-003',
    userId: 'usr-lead-003',
    employeeId: DEMO_USER_EMPLOYEE_IDS.team_lead,
    role: ROLES.TEAM_LEAD,
    roles: [ROLES.TEAM_LEAD],
    permissions: [],
    teamId: 'team-ai-core',
    email: 'teamlead@maxr.internal',
    name: 'Marcus Vance',
    title: 'Lead AI Engineer',
    department: 'AI Department',
    avatarInitials: 'MV',
    avatarUrl: '/alex-mercer-card.png',
  },
  [ROLES.STAFF]: {
    id: 'usr-staff-004',
    userId: 'usr-staff-004',
    employeeId: DEMO_USER_EMPLOYEE_IDS.staff,
    role: ROLES.STAFF,
    roles: [ROLES.STAFF],
    permissions: [],
    email: 'arunkumar@maxr.internal',
    name: 'Arunkumar',
    title: 'AI Intern',
    department: 'AI Department',
    avatarInitials: 'AK',
    avatarUrl: '/user-portrait.png',
  },
};
