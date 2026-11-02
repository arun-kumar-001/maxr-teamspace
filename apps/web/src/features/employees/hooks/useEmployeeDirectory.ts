import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  fetchDepartments,
  fetchDesignations,
  fetchEmployeeDirectory,
  fetchManagerOptions,
} from '../api/employees';
import type {
  DepartmentItem,
  DesignationItem,
  EmployeeDirectoryItem,
  EmployeeDirectoryMeta,
  EmployeeDirectoryQuery,
  EmployeeStatus,
  ManagerOption,
} from '../types';

export interface UseEmployeeDirectoryResult {
  employees: EmployeeDirectoryItem[];
  items: EmployeeDirectoryItem[];
  meta: EmployeeDirectoryMeta;
  isLoading: boolean;
  error: ApiError | null;
  errorMessage: string | null;
  statusCode: number | null;
  isForbidden: boolean;
  departments: DepartmentItem[];
  designations: DesignationItem[];
  managers: ManagerOption[];
  query: EmployeeDirectoryQuery;
  filters: {
    search: string;
    status?: EmployeeStatus | '';
    departmentId?: string;
    designationId?: string;
    managerId?: string;
  };
  sorting: {
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  hasActiveFilters: boolean;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSearch: (search: string) => void;
  setSearchInput: (search: string) => void;
  setStatus: (status: EmployeeStatus | undefined) => void;
  setDepartmentId: (deptId: string | undefined) => void;
  setDesignationId: (desigId: string | undefined) => void;
  setManagerId: (managerId: string | undefined) => void;
  setSort: (
    sortBy: 'name' | 'employeeCode' | 'joiningDate' | 'createdAt',
    sortOrder: 'asc' | 'desc',
  ) => void;
  setSorting: (
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

  const [rawSearch, setRawSearch] = useState<string>(initialQuery.search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialQuery.search ?? '');

  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [meta, setMeta] = useState<EmployeeDirectoryMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [designations, setDesignations] = useState<DesignationItem[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

  // Debounce search input by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 300);

    return () => clearTimeout(handler);
  }, [rawSearch]);

  // Sync debounced search to query.search
  useEffect(() => {
    setQuery((prev) => {
      const sanitized = debouncedSearch.trim() || undefined;
      if (prev.search === sanitized) return prev;
      return { ...prev, search: sanitized, page: 1 };
    });
  }, [debouncedSearch]);

  // Load auxiliary filter options (departments, designations, managers) on mount with cancellation
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadAuxiliaryData() {
      try {
        const [depts, desigs, mgrs] = await Promise.all([
          fetchDepartments(controller.signal),
          fetchDesignations(controller.signal),
          fetchManagerOptions(controller.signal),
        ]);

        if (isMounted) {
          setDepartments(depts);
          setDesignations(desigs);
          setManagers(mgrs);
        }
      } catch {
        // Handled gracefully
      }
    }

    loadAuxiliaryData();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  const fetchTriggerRef = useRef(0);

  const loadEmployees = useCallback(async (currentQuery: EmployeeDirectoryQuery) => {
    const triggerId = ++fetchTriggerRef.current;
    setIsLoading(true);
    setError(null);
    setStatusCode(null);
    setIsForbidden(false);

    try {
      const res = await fetchEmployeeDirectory(currentQuery);
      if (triggerId === fetchTriggerRef.current) {
        setEmployees(res.data);
        setMeta(res.meta);

        // Dynamically merge any new managers discovered in this page's result
        setManagers((prev) => {
          const map = new Map(prev.map((m) => [m.id, m]));
          let added = false;
          for (const emp of res.data) {
            if (emp.manager && !map.has(emp.manager.id)) {
              map.set(emp.manager.id, {
                id: emp.manager.id,
                name:
                  `${emp.manager.firstName} ${emp.manager.lastName}`.trim() ||
                  emp.manager.employeeCode,
                employeeCode: emp.manager.employeeCode,
              });
              added = true;
            }
          }
          return added
            ? Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
            : prev;
        });
      }
    } catch (err: unknown) {
      if (triggerId === fetchTriggerRef.current) {
        if (err instanceof ApiError) {
          if (err.status === 403 || err.statusCode === 403) {
            setIsForbidden(true);
            setError(null);
            setStatusCode(403);
          } else {
            setIsForbidden(false);
            setError(err);
            setStatusCode(err.status ?? err.statusCode ?? 500);
          }
        } else if (err instanceof Error) {
          setIsForbidden(false);
          setError(new ApiError(500, err.message));
          setStatusCode(500);
        } else {
          setIsForbidden(false);
          setError(new ApiError(500, 'An unexpected error occurred while loading employees'));
          setStatusCode(500);
        }
        setEmployees([]);
      }
    } finally {
      if (triggerId === fetchTriggerRef.current) {
        setIsLoading(false);
      }
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
    setRawSearch(search);
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

  const setManagerId = useCallback((managerId: string | undefined) => {
    setQuery((prev) => ({ ...prev, managerId: managerId || undefined, page: 1 }));
  }, []);

  const setSort = useCallback(
    (sortBy: 'name' | 'employeeCode' | 'joiningDate' | 'createdAt', sortOrder: 'asc' | 'desc') => {
      setQuery((prev) => ({ ...prev, sortBy, sortOrder }));
    },
    [],
  );

  const resetFilters = useCallback(() => {
    setRawSearch('');
    setDebouncedSearch('');
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

  const hasActiveFilters = Boolean(
    rawSearch || query.status || query.departmentId || query.designationId || query.managerId,
  );

  return {
    employees,
    items: employees,
    meta,
    isLoading,
    error,
    errorMessage: error?.message ?? null,
    statusCode,
    isForbidden,
    departments,
    designations,
    managers,
    query: {
      ...query,
      search: rawSearch,
    },
    filters: {
      search: rawSearch,
      status: query.status ?? '',
      departmentId: query.departmentId ?? '',
      designationId: query.designationId ?? '',
      managerId: query.managerId ?? '',
    },
    sorting: {
      sortBy: query.sortBy ?? 'name',
      sortOrder: query.sortOrder ?? 'asc',
    },
    hasActiveFilters,
    setPage,
    setPageSize,
    setSearch,
    setSearchInput: setSearch,
    setStatus,
    setDepartmentId,
    setDesignationId,
    setManagerId,
    setSort,
    setSorting: (sortBy, sortOrder) => setSort(sortBy, sortOrder),
    resetFilters,
    refetch,
  };
}
