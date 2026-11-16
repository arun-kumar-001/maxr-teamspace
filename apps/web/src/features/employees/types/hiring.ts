export type HiringStage = 'applied' | 'phone_screen' | 'interview' | 'offer' | 'hired';

export type RoleOpeningStatus = 'hiring' | 'paused' | 'filled';

export type WorkMode = 'Hybrid' | 'Remote' | 'On-site';

export type ContractType = 'Full-time' | 'Part-time' | 'Contract';

export interface HiringRoleOpening {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  departmentName: string;
  designationId?: string;
  contractType: ContractType;
  workMode: WorkMode;
  compensation: string;
  hiresNeeded: number;
  status: RoleOpeningStatus;
  daysOpen: number;
  postedDate: string;
  hiringManagerId?: string;
  hiringManagerName: string;
}

export interface HiringCandidate {
  id: string;
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source: string;
  stage: HiringStage;
  rating: 1 | 2 | 3 | 4 | 5;
  daysInStage: number;
  appliedDate: string;
  notes?: string;
  onboardedEmployeeId?: string;
}

export interface CreateHiringCandidateInput {
  roleId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  source: string;
  stage?: HiringStage;
  rating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
}

export interface CreateRoleOpeningInput {
  title: string;
  departmentId: string;
  departmentName: string;
  designationId?: string;
  contractType: ContractType;
  workMode: WorkMode;
  compensation: string;
  hiresNeeded: number;
  hiringManagerId?: string;
  hiringManagerName: string;
}
