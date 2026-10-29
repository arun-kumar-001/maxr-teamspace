import {
  AttendanceRecord,
  CheckInRequest,
  CheckOutRequest,
  TodayAttendanceSummary,
} from '../types/attendance';

export interface AttendanceHistoryQuery {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface AttendanceHistoryResponse {
  data: AttendanceRecord[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface AttendanceApiClient {
  getActiveSession(): Promise<AttendanceRecord | null>;
  getTodaySummary(): Promise<TodayAttendanceSummary>;
  checkIn(req?: CheckInRequest): Promise<AttendanceRecord>;
  checkOut(req?: CheckOutRequest): Promise<AttendanceRecord>;
  getMyHistory(query?: AttendanceHistoryQuery): Promise<AttendanceHistoryResponse>;
  listAttendance(query?: AttendanceHistoryQuery): Promise<AttendanceHistoryResponse>;
}

export class HttpAttendanceApi implements AttendanceApiClient {
  constructor(private readonly baseUrl = '/api/v1/attendance') {}

  async getActiveSession(): Promise<AttendanceRecord | null> {
    const res = await fetch(`${this.baseUrl}/active`);
    if (!res.ok) {
      throw new Error(`Failed to fetch active session: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  async getTodaySummary(): Promise<TodayAttendanceSummary> {
    const res = await fetch(`${this.baseUrl}/today`);
    if (!res.ok) {
      throw new Error(`Failed to fetch today summary: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  async checkIn(req: CheckInRequest = {}): Promise<AttendanceRecord> {
    const res = await fetch(`${this.baseUrl}/check-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `check-in-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Check-in failed with status ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  async checkOut(req: CheckOutRequest = {}): Promise<AttendanceRecord> {
    const res = await fetch(`${this.baseUrl}/check-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `check-out-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Check-out failed with status ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  async getMyHistory(query: AttendanceHistoryQuery = {}): Promise<AttendanceHistoryResponse> {
    const params = new URLSearchParams();
    if (query.startDate) params.set('startDate', query.startDate);
    if (query.endDate) params.set('endDate', query.endDate);
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const res = await fetch(`${this.baseUrl}/me?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch attendance history: ${res.statusText}`);
    }
    return res.json();
  }

  async listAttendance(query: AttendanceHistoryQuery = {}): Promise<AttendanceHistoryResponse> {
    const params = new URLSearchParams();
    if (query.employeeId) params.set('employeeId', query.employeeId);
    if (query.startDate) params.set('startDate', query.startDate);
    if (query.endDate) params.set('endDate', query.endDate);
    if (query.status) params.set('status', query.status);
    if (query.page) params.set('page', String(query.page));
    if (query.pageSize) params.set('pageSize', String(query.pageSize));

    const res = await fetch(`${this.baseUrl}?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch attendance list: ${res.statusText}`);
    }
    return res.json();
  }
}

export const defaultAttendanceApi = new HttpAttendanceApi();
