import { useCallback, useEffect, useState } from 'react';
import {
  ApiError,
  fetchDepartments,
  fetchDesignations,
  fetchEmployeeDirectory,
} from '../api/employees';
import type {
  DepartmentItem,
  DesignationItem,
  EmployeeDirectoryItem,
  EmployeeDirectoryMeta,
  EmployeeDirectoryQuery,
  EmployeeStatus,
} from '../types';

export interface UseEmployeeDirectoryResult {
  employees: EmployeeDirectoryItem[];
  meta: EmployeeDirectoryMeta;
  isLoading: boolean;
  error: string | null;
  statusCode: number | null;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  query: EmployeeDirectoryQuery;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setStatus: (status: EmployeeStatus | undefined) => void;
  setDepartmentId: (deptId: string | undefined) => void;
  setDesignationId: (desigId: string | undefined) => void;
  setSort: (
    sortBy: 'name' | 'employeeCode' | 'joiningDate' | 'createdAt',
    sortOrder: 'asc' | 'desc',
  ) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
}

const DEFAULT_META: EmployeeDirectoryMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export function useEmployeeDirectory(
  initialQuery: EmployeeDirectoryQuery = {},
): UseEmployeeDirectoryResult {
  const [query, setQuery] = useState<EmployeeDirectoryQuery>({
    page: 1,
    pageSize: 20,
    sortBy: 'name',
    sortOrder: 'asc',
    ...initialQuery,
  });

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [meta, setMeta] = useState<EmployeeDirectoryMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);

  // Load department and designation options once on mount
  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchDepartments(), fetchDesignations()]).then(([depts, desigs]) => {
      if (!cancelled) {
        setDepartments(depts);
        setDesignations(desigs);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEmployees = useCallback(async (currentQuery: EmployeeDirectoryQuery) => {
    setIsLoading(true);
    setError(null);
    setStatusCode(null);

    try {
      const res = await fetchEmployeeDirectory(currentQuery);
      setEmployees(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred while loading employees');
        setStatusCode(500);
      }
      setEmployees([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees(query);
  }, [query, loadEmployees]);

  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const setSearch = useCallback((search: string) => {
    setQuery((prev) => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const setStatus = useCallback((status: EmployeeStatus | undefined) => {
    setQuery((prev) => ({ ...prev, status: status || undefined, page: 1 }));
  }, []);

  const setDepartmentId = useCallback((departmentId: string | undefined) => {
    setQuery((prev) => ({ ...prev, departmentId: departmentId || undefined, page: 1 }));
  }, []);

  const setDesignationId = useCallback((designationId: string | undefined) => {
    setQuery((prev) => ({ ...prev, designationId: designationId || undefined, page: 1 }));
  }, []);

  const setSort = useCallback(
    (sortBy: 'name' | 'employeeCode' | 'joiningDate' | 'createdAt', sortOrder: 'asc' | 'desc') => {
      setQuery((prev) => ({ ...prev, sortBy, sortOrder }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setQuery({
      page: 1,
      pageSize: 20,
      sortBy: 'name',
      sortOrder: 'asc',
    });
  }, []);

  const refetch = useCallback(async () => {
    await loadEmployees(query);
  }, [loadEmployees, query]);

  return {
    employees,
    meta,
    isLoading,
    error,
    statusCode,
    departments,
    designations,
    query,
    setPage,
    setPageSize,
    setSearch,
    setStatus,
    setDepartmentId,
    setDesignationId,
    setSort,
    resetFilters,
    refetch,
  };
}
