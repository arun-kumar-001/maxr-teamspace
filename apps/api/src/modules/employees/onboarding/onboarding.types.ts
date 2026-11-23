import type { Role } from '@maxr/shared';

export type OnboardingStep = 'hr' | 'system' | 'it_admin' | 'employee' | 'completed';
export type OnboardingStatus = 'in_progress' | 'completed';

export interface OnboardingItem {
  id: string;
  checklistId: string;
  step: 'hr' | 'system' | 'it_admin' | 'employee';
  itemKey: string;
  title: string;
  description: string | null;
  isVerified: boolean;
  verifiedAt: Date | null;
  verifiedBy: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OnboardingChecklistSummary {
  id: string;
  employeeId: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  departmentId: string;
  departmentName: string;
  designationId: string;
  designationTitle: string;
  managerId: string | null;
  joiningDate: string;
  employeeStatus: string;
  userActive: boolean;
  status: OnboardingStatus;
  currentStep: OnboardingStep;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  totalItems: number;
  verifiedItems: number;
}

export interface OnboardingChecklistDetail extends OnboardingChecklistSummary {
  items: OnboardingItem[];
}

export interface OnboardingCaller {
  actorId: string;
  employeeId: string;
  roles: readonly Role[];
  requestId?: string;
  ip?: string;
}

export interface ListOnboardingQuery {
  page?: number;
  pageSize?: number;
  status?: OnboardingStatus;
  step?: OnboardingStep;
  departmentId?: string;
  search?: string;
}

export interface SetPasswordDto {
  token: string;
  newPassword: string;
}

export interface VerifyItemDto {
  notes?: string;
}

export interface EmployeeStepDto {
  profileConfirmed: boolean;
  policiesAcknowledged: boolean;
  notes?: string;
}

export interface SetPasswordTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}
