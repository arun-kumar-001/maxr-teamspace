import { randomUUID } from 'crypto';
import { SortSpec } from '../../http/pagination';
import {
  Approval,
  ApprovalStatus,
  ApprovalSubjectType,
  CreateApprovalDto,
} from './approvals.types';

export interface ApprovalFindManyParams {
  offset: number;
  limit: number;
  sort: SortSpec;
  status?: ApprovalStatus;
  subjectType?: ApprovalSubjectType;
}

export interface IApprovalsRepository {
  findById(id: string): Promise<Approval | null>;
  create(dto: CreateApprovalDto): Promise<Approval>;
  updateDecision(
    id: string,
    approverId: string,
    status: 'APPROVED' | 'REJECTED',
    comment?: string,
  ): Promise<Approval | null>;
  findMany(
    params: ApprovalFindManyParams,
    scopeRequesterIds?: string[],
  ): Promise<{ items: Approval[]; total: number }>;
}

export class ApprovalsRepository implements IApprovalsRepository {
  private readonly items = new Map<string, Approval>();

  async findById(id: string): Promise<Approval | null> {
    return this.items.get(id) ?? null;
  }

  async create(dto: CreateApprovalDto): Promise<Approval> {
    const now = new Date().toISOString();
    const entity: Approval = {
      id: randomUUID(),
      subjectType: dto.subjectType,
      subjectId: dto.subjectId,
      requesterId: dto.requesterId,
      approverId: null,
      status: 'PENDING',
      comment: null,
      decidedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(entity.id, entity);
    return entity;
  }

  async updateDecision(
    id: string,
    approverId: string,
    status: 'APPROVED' | 'REJECTED',
    comment?: string,
  ): Promise<Approval | null> {
    const existing = this.items.get(id);
    if (!existing || existing.status !== 'PENDING') {
      return null;
    }

    const now = new Date().toISOString();
    const updated: Approval = {
      ...existing,
      approverId,
      status,
      comment: comment ?? null,
      decidedAt: now,
      updatedAt: now,
    };

    this.items.set(id, updated);
    return updated;
  }

  async findMany(
    params: ApprovalFindManyParams,
    scopeRequesterIds?: string[],
  ): Promise<{ items: Approval[]; total: number }> {
    let rows = [...this.items.values()];

    if (scopeRequesterIds) {
      rows = rows.filter((r) => scopeRequesterIds.includes(r.requesterId));
    }
    if (params.status) {
      rows = rows.filter((r) => r.status === params.status);
    }
    if (params.subjectType) {
      rows = rows.filter((r) => r.subjectType === params.subjectType);
    }

    const direction = params.sort.order === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const aVal = a[params.sort.column as keyof Approval] ?? '';
      const bVal = b[params.sort.column as keyof Approval] ?? '';
      return (aVal < bVal ? -1 : aVal > bVal ? 1 : 0) * direction;
    });

    const total = rows.length;
    const items = rows.slice(params.offset, params.offset + params.limit);

    return { items, total };
  }
}
