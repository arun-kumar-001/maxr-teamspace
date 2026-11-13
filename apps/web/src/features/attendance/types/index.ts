export type AttendanceStatus =
  'present' | 'absent' | 'half_day' | 'late' | 'on_leave' | 'holiday' | 'weekend';

export type WorkMode = 'office' | 'remote';

export interface AttendanceLocation {
  latitude?: number;
  longitude?: number;
  address?: string;
  workMode?: WorkMode;
}

export interface AttendanceBreak {
  startTime: string;
  endTime: string | null;
}

export interface AttendanceRecord extends Record<string, unknown> {
  id: string;
  employeeId: string;
  employeeName?: string;
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

export interface TodayAttendanceSummary {
  workDate: string;
  totalDurationMinutes: number;
  sessionsCount: number;
  activeSession: AttendanceRecord | null;
  sessions: AttendanceRecord[];
}

export interface CheckInRequest {
  location?: AttendanceLocation;
  notes?: string;
}

export interface CheckOutRequest {
  notes?: string;
}

export interface AttendanceQuery {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  status?: AttendanceStatus;
  employeeId?: string;
  sortBy?: 'workDate' | 'checkInTime' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AttendancePaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

export interface AttendanceListResponse {
  data: AttendanceRecord[];
  meta: AttendancePaginationMeta;
}

export type CorrectionStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface AttendanceCorrection extends Record<string, unknown> {
  id: string;
  attendanceRecordId: string;
  employeeId: string;
  workDate: string;
  originalCheckIn: string;
  originalCheckOut: string | null;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
  status: CorrectionStatus;
  approvalId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RequestCorrectionPayload {
  attendanceRecordId: string;
  requestedCheckIn: string;
  requestedCheckOut: string;
  reason: string;
}

export interface CorrectionQuery {
  page?: number;
  pageSize?: number;
  status?: CorrectionStatus;
}

export interface PaginatedCorrectionsResponse {
  data: AttendanceCorrection[];
  meta: AttendancePaginationMeta;
}

export type CalendarCategory = 'present' | 'absent' | 'late' | 'wfh' | 'on_leave' | 'holiday';

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
  workMode: WorkMode | null;
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
