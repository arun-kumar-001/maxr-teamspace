export interface Shift {
  id: string;
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateShiftRequest {
  name: string;
  code: string;
  startTime: string;
  endTime: string;
  breakMinutes?: number;
  isActive?: boolean;
}

export interface AttendancePolicy {
  id: string;
  name: string;
  gracePeriodMinutes: number;
  halfDayThresholdMinutes: number;
  fullDayThresholdMinutes: number;
  timezone: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateAttendancePolicyRequest {
  name?: string;
  gracePeriodMinutes?: number;
  halfDayThresholdMinutes?: number;
  fullDayThresholdMinutes?: number;
  timezone?: string;
  isDefault?: boolean;
}
