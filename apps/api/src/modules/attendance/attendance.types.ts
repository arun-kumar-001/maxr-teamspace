export type AttendanceStatus =
  'present' | 'absent' | 'half_day' | 'late' | 'on_leave' | 'holiday' | 'weekend';

export interface AttendanceLocation {
  latitude?: number;
  longitude?: number;
  address?: string;
  workMode?: 'office' | 'remote';
}

export interface AttendanceBreak {
  startTime: string; // ISO 8601 UTC
  endTime: string | null;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  workDate: string; // YYYY-MM-DD
  checkInTime: string; // ISO 8601 UTC
  checkOutTime: string | null; // ISO 8601 UTC
  durationMinutes: number | null;
  breaks?: AttendanceBreak[];
  breakMinutes?: number;
  status: AttendanceStatus;
  location: AttendanceLocation | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TeamCalendarEmployee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  designation: string | null;
}

export interface TeamCalendarDepartment {
  id: string;
  name: string;
}

export interface TeamCalendarHoliday {
  id: string;
  date: string;
  name: string;
}

export type CalendarCategory = 'present' | 'absent' | 'late' | 'wfh' | 'on_leave' | 'holiday';

export interface TeamCalendarEntry {
  id: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  departmentId: string | null;
  departmentName: string | null;
  designation: string | null;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  durationMinutes: number | null;
  workMode: 'office' | 'remote' | null;
  category: CalendarCategory;
  statusLabel: string;
  leaveTypeName?: string | null;
  holidayName?: string | null;
}

export interface TeamCalendarData {
  employees: TeamCalendarEmployee[];
  departments: TeamCalendarDepartment[];
  holidays: TeamCalendarHoliday[];
  entries: TeamCalendarEntry[];
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
