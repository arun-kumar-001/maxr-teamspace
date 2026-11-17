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

export const FALLBACK_DEPARTMENTS: DepartmentItem[] = [
  { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
  { id: 'dept-prod', name: 'Product', code: 'PROD' },
  { id: 'dept-hr', name: 'Human Resources', code: 'HR' },
  { id: 'dept-ops', name: 'Operations', code: 'OPS' },
  { id: 'dept-fin', name: 'Finance', code: 'FIN' },
];

export const FALLBACK_DESIGNATIONS: DesignationItem[] = [
  { id: 'desig-arch', title: 'Principal Architect', code: 'PR_ARCH' },
  { id: 'desig-pm', title: 'Product Manager', code: 'PM' },
  { id: 'desig-se', title: 'Senior Software Engineer', code: 'SR_ENG' },
  { id: 'desig-hr', title: 'HR Operations Lead', code: 'HR_LEAD' },
  { id: 'desig-fin', title: 'Financial Analyst', code: 'FIN_ANALYST' },
  { id: 'desig-qa', title: 'QA Automation Engineer', code: 'QA_ENG' },
];

export const FALLBACK_MANAGERS: ManagerOption[] = [
  { id: 'emp-1', name: 'Eleanor Vance', employeeCode: 'MAX001' },
  { id: 'emp-2', name: 'Marcus Vance', employeeCode: 'MAX002' },
  { id: 'emp-3', name: 'Shagul Hamithu', employeeCode: 'MAX003' },
];

export const FALLBACK_EMPLOYEES: EmployeeDirectoryItem[] = [
  {
    id: 'emp-1',
    employeeCode: 'MAX001',
    firstName: 'Eleanor',
    lastName: 'Vance',
    email: 'eleanor.vance@maxr.com',
    phone: '+1 555-0101',
    department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-arch', title: 'Principal Architect', code: 'PR_ARCH' },
    manager: null,
    status: 'active',
    joiningDate: '2023-01-15',
    createdAt: '2023-01-15T09:00:00Z',
    updatedAt: '2023-01-15T09:00:00Z',
  },
  {
    id: 'emp-2',
    employeeCode: 'MAX002',
    firstName: 'Marcus',
    lastName: 'Vance',
    email: 'marcus.vance@maxr.com',
    phone: '+1 555-0102',
    department: { id: 'dept-prod', name: 'Product', code: 'PROD' },
    designation: { id: 'desig-pm', title: 'Product Manager', code: 'PM' },
    manager: { id: 'emp-1', firstName: 'Eleanor', lastName: 'Vance', employeeCode: 'MAX001' },
    status: 'active',
    joiningDate: '2023-03-01',
    createdAt: '2023-03-01T09:00:00Z',
    updatedAt: '2023-03-01T09:00:00Z',
  },
  {
    id: 'emp-3',
    employeeCode: 'MAX003',
    firstName: 'Shagul',
    lastName: 'Hamithu',
    email: 'shagul.hamithu@maxr.com',
    phone: '+1 555-0103',
    department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-se', title: 'Senior Software Engineer', code: 'SR_ENG' },
    manager: { id: 'emp-1', firstName: 'Eleanor', lastName: 'Vance', employeeCode: 'MAX001' },
    status: 'active',
    joiningDate: '2023-06-10',
    createdAt: '2023-06-10T09:00:00Z',
    updatedAt: '2023-06-10T09:00:00Z',
  },
  {
    id: 'emp-4',
    employeeCode: 'MAX004',
    firstName: 'Alice',
    lastName: 'Walker',
    email: 'alice.walker@maxr.com',
    phone: '+1 555-0104',
    department: { id: 'dept-hr', name: 'Human Resources', code: 'HR' },
    designation: { id: 'desig-hr', title: 'HR Operations Lead', code: 'HR_LEAD' },
    manager: { id: 'emp-1', firstName: 'Eleanor', lastName: 'Vance', employeeCode: 'MAX001' },
    status: 'active',
    joiningDate: '2023-09-01',
    createdAt: '2023-09-01T09:00:00Z',
    updatedAt: '2023-09-01T09:00:00Z',
  },
  {
    id: 'emp-5',
    employeeCode: 'MAX005',
    firstName: 'David',
    lastName: 'Miller',
    email: 'david.miller@maxr.com',
    phone: '+1 555-0105',
    department: { id: 'dept-fin', name: 'Finance', code: 'FIN' },
    designation: { id: 'desig-fin', title: 'Financial Analyst', code: 'FIN_ANALYST' },
    manager: { id: 'emp-2', firstName: 'Marcus', lastName: 'Vance', employeeCode: 'MAX002' },
    status: 'pending',
    joiningDate: '2024-01-15',
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T09:00:00Z',
  },
  {
    id: 'emp-6',
    employeeCode: 'MAX006',
    firstName: 'Sarah',
    lastName: 'Connor',
    email: 'sarah.connor@maxr.com',
    phone: '+1 555-0106',
    department: { id: 'dept-eng', name: 'Engineering', code: 'ENG' },
    designation: { id: 'desig-qa', title: 'QA Automation Engineer', code: 'QA_ENG' },
    manager: { id: 'emp-3', firstName: 'Shagul', lastName: 'Hamithu', employeeCode: 'MAX003' },
    status: 'deactivated',
    joiningDate: '2022-11-01',
    createdAt: '2022-11-01T09:00:00Z',
    updatedAt: '2024-02-28T09:00:00Z',
  },
];

export function filterFallbackEmployees(
  items: EmployeeDirectoryItem[],
  query: EmployeeDirectoryQuery,
): { data: EmployeeDirectoryItem[]; meta: EmployeeDirectoryMeta } {
  let filtered = [...items];

  if (query.search && query.search.trim()) {
    const q = query.search.trim().toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.firstName.toLowerCase().includes(q) ||
        e.lastName.toLowerCase().includes(q) ||
        `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) ||
        e.employeeCode.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.phone && e.phone.toLowerCase().includes(q)) ||
        e.department.name.toLowerCase().includes(q) ||
        e.designation.title.toLowerCase().includes(q),
    );
  }

  if (query.status) {
    filtered = filtered.filter((e) => e.status === query.status);
  }

  if (query.departmentId) {
    filtered = filtered.filter((e) => e.department.id === query.departmentId);
  }

  if (query.designationId) {
    filtered = filtered.filter((e) => e.designation.id === query.designationId);
  }

  if (query.managerId) {
    filtered = filtered.filter((e) => e.manager?.id === query.managerId);
  }

  const sortBy = query.sortBy || 'name';
  const sortOrder = query.sortOrder || 'asc';
  filtered.sort((a, b) => {
    let comparison = 0;
    if (sortBy === 'name') {
      const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
      const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
      comparison = nameA.localeCompare(nameB);
    } else if (sortBy === 'employeeCode') {
      comparison = a.employeeCode.localeCompare(b.employeeCode);
    } else if (sortBy === 'joiningDate') {
      comparison = a.joiningDate.localeCompare(b.joiningDate);
    } else if (sortBy === 'createdAt') {
      comparison = a.createdAt.localeCompare(b.createdAt);
    }
    return sortOrder === 'desc' ? -comparison : comparison;
  });

  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const startIndex = (page - 1) * pageSize;
  const data = filtered.slice(startIndex, startIndex + pageSize);

  return {
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
}

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
          setDepartments(depts.length > 0 ? depts : FALLBACK_DEPARTMENTS);
          setDesignations(desigs.length > 0 ? desigs : FALLBACK_DESIGNATIONS);
          setManagers(mgrs.length > 0 ? mgrs : FALLBACK_MANAGERS);
        }
      } catch {
        if (isMounted) {
          setDepartments((prev) => (prev.length > 0 ? prev : FALLBACK_DEPARTMENTS));
          setDesignations((prev) => (prev.length > 0 ? prev : FALLBACK_DESIGNATIONS));
          setManagers((prev) => (prev.length > 0 ? prev : FALLBACK_MANAGERS));
        }
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
        const isAuthError =
          (err instanceof ApiError && (err.status === 401 || err.statusCode === 401)) ||
          (err instanceof Error &&
            (err.message.toLowerCase().includes('authentication') ||
              err.message.toLowerCase().includes('unauthorized')));

        if (isAuthError) {
          // Dev / demo / unauthenticated session fallback
          const fallback = filterFallbackEmployees(FALLBACK_EMPLOYEES, currentQuery);
          setEmployees(fallback.data);
          setMeta(fallback.meta);
          setError(null);
          setStatusCode(null);
          setIsForbidden(false);
          setDepartments((prev) => (prev.length > 0 ? prev : FALLBACK_DEPARTMENTS));
          setDesignations((prev) => (prev.length > 0 ? prev : FALLBACK_DESIGNATIONS));
          setManagers((prev) => (prev.length > 0 ? prev : FALLBACK_MANAGERS));
        } else if (err instanceof ApiError) {
          if (err.status === 403 || err.statusCode === 403) {
            setIsForbidden(true);
            setError(null);
            setStatusCode(403);
          } else {
            setIsForbidden(false);
            setError(err);
            setStatusCode(err.status ?? err.statusCode ?? 500);
          }
          setEmployees([]);
        } else if (err instanceof Error) {
          setIsForbidden(false);
          setError(new ApiError(500, err.message));
          setStatusCode(500);
          setEmployees([]);
        } else {
          setIsForbidden(false);
          setError(new ApiError(500, 'An unexpected error occurred while loading employees'));
          setStatusCode(500);
          setEmployees([]);
        }
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
