export type AttendanceStatus = 'PRESENT' | 'LATE' | 'HALF_DAY' | 'EARLY_DEPARTURE' | 'ON_LEAVE';

export interface AttendanceLocation {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string;
  checkInTime: string;
  checkOutTime: string | null;
  durationMinutes: number | null;
  status: AttendanceStatus;
  location?: AttendanceLocation | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TodayAttendanceSummary {
  date: string;
  activeSession: AttendanceRecord | null;
  completedSessions: AttendanceRecord[];
  totalWorkedMinutes: number;
  status: AttendanceStatus;
}

export interface CheckInRequest {
  location?: AttendanceLocation;
  notes?: string;
}

export interface CheckOutRequest {
  notes?: string;
}
