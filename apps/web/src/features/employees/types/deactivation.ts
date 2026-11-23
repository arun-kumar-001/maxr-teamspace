export interface DirectReport {
  id: string;
  employeeCode: string;
  name: string;
}

export interface DeactivationResult {
  id: string;
  status: 'deactivated';
  deactivatedAt: string;
  version: number;
  alreadyDeactivated: boolean;
  sessionsRevoked: number;
  directReports: DirectReport[];
}
