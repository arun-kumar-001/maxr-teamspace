export type AttendanceStatus =
  'PRESENT' | 'ABSENT' | 'HALF_DAY' | 'LATE' | 'ON_LEAVE' | 'HOLIDAY' | 'WEEKEND';

export interface AttendanceLocation {
  latitude?: number;
  longitude?: number;
  address?: string;
  workMode?: 'office' | 'remote';
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  checkInTime: string; // ISO 8601 UTC
  checkOutTime: string | null; // ISO 8601 UTC
  durationMinutes: number | null;
  status: AttendanceStatus;
  location: AttendanceLocation | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckInDto {
  location?: AttendanceLocation;
  notes?: string;
}

export interface CheckOutDto {
  notes?: string;
}

export interface TodayAttendanceSummary {
  workDate: string;
  totalDurationMinutes: number;
  sessionsCount: number;
  activeSession: AttendanceRecord | null;
  sessions: AttendanceRecord[];
}
