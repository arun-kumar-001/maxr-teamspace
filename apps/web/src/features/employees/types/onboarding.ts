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
  verifiedAt: string | null;
  verifiedBy: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  totalItems: number;
  verifiedItems: number;
}

export interface OnboardingChecklistDetail extends OnboardingChecklistSummary {
  items: OnboardingItem[];
}

export interface OnboardingListQuery {
  page?: number;
  pageSize?: number;
  status?: OnboardingStatus;
  step?: OnboardingStep;
  departmentId?: string;
  search?: string;
}

export interface OnboardingListResponse {
  data: OnboardingChecklistSummary[];
  total: number;
}
