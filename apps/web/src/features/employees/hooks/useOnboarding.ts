import { useCallback, useEffect, useState } from 'react';
import { ApiError, fetchDepartments } from '../api/employees';
import { fetchMyOnboarding, fetchOnboardingDetail, fetchOnboardingList } from '../api/onboarding';
import type { DepartmentItem } from '../types';
import type {
  OnboardingChecklistDetail,
  OnboardingChecklistSummary,
  OnboardingListQuery,
  OnboardingStatus,
  OnboardingStep,
} from '../types/onboarding';

export interface UseOnboardingListResult {
  checklists: OnboardingChecklistSummary[];
  total: number;
  isLoading: boolean;
  error: string | null;
  statusCode: number | null;
  departments: DepartmentItem[];
  query: OnboardingListQuery;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: OnboardingStatus | undefined) => void;
  setStep: (step: OnboardingStep | undefined) => void;
  setDepartmentId: (deptId: string | undefined) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
}

export const FALLBACK_CHECKLISTS: OnboardingChecklistSummary[] = [
  {
    id: 'chk-1',
    employeeId: 'emp-1',
    employeeCode: 'EMP-001',
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@maxr.internal',
    departmentId: '30000000-0000-0000-0000-000000000001',
    departmentName: 'Engineering',
    designationId: '40000000-0000-0000-0000-000000000004',
    designationTitle: 'Software Engineer',
    managerId: null,
    joiningDate: '2026-11-01',
    employeeStatus: 'pending',
    userActive: false,
    status: 'in_progress',
    currentStep: 'hr',
    completedAt: null,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    totalItems: 14,
    verifiedItems: 3,
  },
  {
    id: 'chk-2',
    employeeId: 'emp-2',
    employeeCode: 'EMP-002',
    firstName: 'Karthik',
    lastName: 'Rajan',
    email: 'karthik.rajan@maxr.internal',
    departmentId: '30000000-0000-0000-0000-000000000001',
    departmentName: 'Development',
    designationId: '40000000-0000-0000-0000-000000000002',
    designationTitle: 'Senior Developer',
    managerId: null,
    joiningDate: '2026-11-10',
    employeeStatus: 'pending',
    userActive: false,
    status: 'in_progress',
    currentStep: 'it_admin',
    completedAt: null,
    createdAt: '2026-11-05T10:00:00Z',
    updatedAt: '2026-11-05T10:00:00Z',
    totalItems: 14,
    verifiedItems: 8,
  },
  {
    id: 'chk-3',
    employeeId: 'emp-3',
    employeeCode: 'EMP-003',
    firstName: 'Ananya',
    lastName: 'Iyer',
    email: 'ananya.iyer@maxr.internal',
    departmentId: '30000000-0000-0000-0000-000000000002',
    departmentName: 'Digital Marketing',
    designationId: '40000000-0000-0000-0000-000000000003',
    designationTitle: 'Growth Marketer',
    managerId: null,
    joiningDate: '2026-11-15',
    employeeStatus: 'pending',
    userActive: false,
    status: 'in_progress',
    currentStep: 'employee',
    completedAt: null,
    createdAt: '2026-11-08T10:00:00Z',
    updatedAt: '2026-11-08T10:00:00Z',
    totalItems: 14,
    verifiedItems: 11,
  },
];

function getFallbackDetail(empId: string): OnboardingChecklistDetail {
  const found = FALLBACK_CHECKLISTS.find((c) => c.employeeId === empId);
  const summary: OnboardingChecklistSummary = found ?? {
    ...FALLBACK_CHECKLISTS[0]!,
    employeeId: empId,
  };
  const chkId = summary.id;
  const emailPrefix = `${(summary.firstName || 'employee').toLowerCase()}.${(summary.lastName || 'member').toLowerCase()}`;

  return {
    ...summary,
    items: [
      {
        id: 'item-1',
        checklistId: chkId,
        step: 'hr',
        itemKey: 'offer_accepted',
        title: 'Offer Letter Signed & Accepted',
        description: 'Signed copy of official offer letter returned by candidate',
        isVerified: true,
        verifiedAt: '2026-11-01T10:00:00Z',
        verifiedBy: 'HR Manager',
        notes: 'Signed electronically via docu-sign',
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T10:00:00Z',
      },
      {
        id: 'item-2',
        checklistId: chkId,
        step: 'hr',
        itemKey: 'identity_docs',
        title: 'ID Verification & Address Proof',
        description: 'Aadhaar, PAN card, and address verification uploaded',
        isVerified: true,
        verifiedAt: '2026-11-01T11:00:00Z',
        verifiedBy: 'HR Manager',
        notes: 'Verified against government portal',
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T11:00:00Z',
      },
      {
        id: 'item-3',
        checklistId: chkId,
        step: 'hr',
        itemKey: 'bgv_check',
        title: 'Background Verification Clearance',
        description: 'Previous employment and educational verification completed',
        isVerified: true,
        verifiedAt: '2026-11-02T14:30:00Z',
        verifiedBy: 'HR Manager',
        notes: 'Green status from screening agency',
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-02T14:30:00Z',
      },
      {
        id: 'item-4',
        checklistId: chkId,
        step: 'system',
        itemKey: 'email_created',
        title: 'Corporate Email Account Created',
        description: 'Google Workspace / Microsoft 365 official email address provisioned',
        isVerified: true,
        verifiedAt: '2026-11-03T10:00:00Z',
        verifiedBy: 'IT Admin',
        notes: `${emailPrefix}@maxr.internal created`,
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-03T10:00:00Z',
      },
      {
        id: 'item-5',
        checklistId: chkId,
        step: 'system',
        itemKey: 'slack_access',
        title: 'Teamspace & Collaboration Tools Access',
        description: 'Slack/Teams invited, GitHub repository team added, Jira workspace assigned',
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T09:00:00Z',
      },
      {
        id: 'item-6',
        checklistId: chkId,
        step: 'it_admin',
        itemKey: 'hardware_allocation',
        title: 'Laptop & Hardware Asset Allocation',
        description: 'MacBook Pro / ThinkPad issued with asset barcode tag',
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T09:00:00Z',
      },
      {
        id: 'item-7',
        checklistId: chkId,
        step: 'employee',
        itemKey: 'bank_details',
        title: 'Direct Deposit / Bank Account Details',
        description: 'Cancelled cheque / bank passbook submitted for salary disbursement',
        isVerified: false,
        verifiedAt: null,
        verifiedBy: null,
        notes: null,
        createdAt: '2026-11-01T09:00:00Z',
        updatedAt: '2026-11-01T09:00:00Z',
      },
    ],
  };
}

export function useOnboardingList(initialQuery: OnboardingListQuery = {}): UseOnboardingListResult {
  const [query, setQuery] = useState<OnboardingListQuery>({
    page: 1,
    pageSize: 20,
    ...initialQuery,
  });

  const [checklists, setChecklists] = useState<OnboardingChecklistSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchDepartments().then((depts) => {
      if (!cancelled) {
        setDepartments(depts);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadChecklists = useCallback(async (currentQuery: OnboardingListQuery) => {
    setIsLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const res = await fetchOnboardingList(currentQuery);
      setChecklists(res.data);
      setTotal(res.total);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message);
        setStatusCode(err.status);
        setChecklists([]);
        setTotal(0);
      } else {
        // Fallback demo data for local dev / offline mode
        setChecklists(FALLBACK_CHECKLISTS);
        setTotal(FALLBACK_CHECKLISTS.length);
        setError(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadChecklists(query);
  }, [query, loadChecklists]);

  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const setStatus = useCallback((status: OnboardingStatus | undefined) => {
    setQuery((prev) => ({ ...prev, status: status || undefined, page: 1 }));
  }, []);

  const setStep = useCallback((step: OnboardingStep | undefined) => {
    setQuery((prev) => ({ ...prev, step: step || undefined, page: 1 }));
  }, []);

  const setDepartmentId = useCallback((departmentId: string | undefined) => {
    setQuery((prev) => ({ ...prev, departmentId: departmentId || undefined, page: 1 }));
  }, []);

  const resetFilters = useCallback(() => {
    setQuery({
      page: 1,
      pageSize: 20,
    });
  }, []);

  const refetch = useCallback(async () => {
    await loadChecklists(query);
  }, [loadChecklists, query]);

  return {
    checklists,
    total,
    isLoading,
    error,
    statusCode,
    departments,
    query,
    setPage,
    setPageSize,
    setSearch,
    setStatus,
    setStep,
    setDepartmentId,
    resetFilters,
    refetch,
  };
}

export interface UseOnboardingDetailResult {
  detail: OnboardingChecklistDetail | null;
  isLoading: boolean;
  error: string | null;
  statusCode: number | null;
  refetch: () => Promise<void>;
  setDetail: React.Dispatch<React.SetStateAction<OnboardingChecklistDetail | null>>;
}

export function useOnboardingDetail(employeeId: string | null): UseOnboardingDetailResult {
  const [detail, setDetail] = useState<OnboardingChecklistDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(employeeId));
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    if (!employeeId) {
      setDetail(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const data = await fetchOnboardingDetail(employeeId);
      setDetail(data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message);
        setStatusCode(err.status);
        setDetail(null);
      } else {
        // Fallback demo detail for local dev / offline mode
        setDetail(getFallbackDetail(employeeId));
        setError(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return {
    detail,
    isLoading,
    error,
    statusCode,
    refetch: loadDetail,
    setDetail,
  };
}

export function useMyOnboarding(): UseOnboardingDetailResult {
  const [detail, setDetail] = useState<OnboardingChecklistDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const loadDetail = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const data = await fetchMyOnboarding();
      setDetail(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred while loading your onboarding checklist');
        setStatusCode(500);
      }
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  return {
    detail,
    isLoading,
    error,
    statusCode,
    refetch: loadDetail,
    setDetail,
  };
}
