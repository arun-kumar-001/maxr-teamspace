import {
  AttendancePolicy,
  CreateShiftRequest,
  Shift,
  UpdateAttendancePolicyRequest,
} from '../types/shifts';

export interface ShiftsListResponse {
  data: Shift[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ShiftsApiClient {
  listShifts(): Promise<ShiftsListResponse>;
  createShift(req: CreateShiftRequest): Promise<Shift>;
  getPolicy(): Promise<AttendancePolicy>;
  updatePolicy(req: UpdateAttendancePolicyRequest): Promise<AttendancePolicy>;
}

export class HttpShiftsApi implements ShiftsApiClient {
  constructor(private readonly baseUrl = '/api/v1/shifts') {}

  async listShifts(): Promise<ShiftsListResponse> {
    const res = await fetch(`${this.baseUrl}`);
    if (!res.ok) {
      throw new Error(`Failed to list shifts: ${res.statusText}`);
    }
    return res.json();
  }

  async createShift(req: CreateShiftRequest): Promise<Shift> {
    const res = await fetch(`${this.baseUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `shift-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Failed to create shift: ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  async getPolicy(): Promise<AttendancePolicy> {
    const res = await fetch(`${this.baseUrl}/policies`);
    if (!res.ok) {
      throw new Error(`Failed to get policy: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  async updatePolicy(req: UpdateAttendancePolicyRequest): Promise<AttendancePolicy> {
    const res = await fetch(`${this.baseUrl}/policies`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Failed to update policy: ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }
}

export const defaultShiftsApi = new HttpShiftsApi();
