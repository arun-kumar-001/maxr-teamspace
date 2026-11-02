/**
 * Canonical System Roles per Specification & ADR D-01
 */
export const ROLES = {
  ADMIN: 'admin',
  HR_MANAGER: 'hr_manager',
  TEAM_LEAD: 'team_lead',
  STAFF: 'staff',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Record Scope Definitions for Multi-Tenant / Team Boundaries
 */
export const RECORD_SCOPES = {
  OWN: 'own',
  TEAM: 'team',
  HR: 'hr',
  ALL: 'all',
} as const;

export type RecordScope = (typeof RECORD_SCOPES)[keyof typeof RECORD_SCOPES];

/**
 * Human-readable role display names for UI presentation
 */
export const ROLE_DISPLAY_NAMES: Record<Role, string> = {
  [ROLES.ADMIN]: 'Super Admin / Founder',
  [ROLES.HR_MANAGER]: 'HR Manager',
  [ROLES.TEAM_LEAD]: 'Team Lead',
  [ROLES.STAFF]: 'Staff / Employee',
};
