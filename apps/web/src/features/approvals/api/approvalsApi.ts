import { Approval, ApprovalsFilter, DecisionRequest } from '../types/approvals';

export interface ApprovalsListResponse {
  data: Approval[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface ApprovalsApiClient {
  list(filter?: ApprovalsFilter): Promise<ApprovalsListResponse>;
  getById(id: string): Promise<Approval>;
  approve(id: string, req?: DecisionRequest): Promise<Approval>;
  reject(id: string, req?: DecisionRequest): Promise<Approval>;
}

export class HttpApprovalsApi implements ApprovalsApiClient {
  constructor(private readonly baseUrl = '/api/v1/approvals') {}

  async list(filter: ApprovalsFilter = {}): Promise<ApprovalsListResponse> {
    const params = new URLSearchParams();
    if (filter.status) params.set('status', filter.status);
    if (filter.subjectType) params.set('subjectType', filter.subjectType);
    if (filter.page) params.set('page', String(filter.page));
    if (filter.pageSize) params.set('pageSize', String(filter.pageSize));

    const url = `${this.baseUrl}${params.toString() ? `?${params.toString()}` : ''}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to list approvals: ${res.statusText}`);
    }
    return res.json();
  }

  async getById(id: string): Promise<Approval> {
    const res = await fetch(`${this.baseUrl}/${id}`);
    if (!res.ok) {
      throw new Error(`Failed to get approval: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  }

  async approve(id: string, req: DecisionRequest = {}): Promise<Approval> {
    const res = await fetch(`${this.baseUrl}/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `appr-appr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Approval failed with status ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }

  async reject(id: string, req: DecisionRequest = {}): Promise<Approval> {
    const res = await fetch(`${this.baseUrl}/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `appr-rej-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) {
      const errorJson = await res.json().catch(() => ({}));
      throw new Error(errorJson?.error?.message || `Rejection failed with status ${res.status}`);
    }
    const json = await res.json();
    return json.data;
  }
}
