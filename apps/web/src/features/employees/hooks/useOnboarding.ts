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
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred while loading onboarding records');
        setStatusCode(500);
      }
      setChecklists([]);
      setTotal(0);
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
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred while loading checklist details');
        setStatusCode(500);
      }
      setDetail(null);
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
