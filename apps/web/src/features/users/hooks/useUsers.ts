import { useCallback, useEffect, useState } from 'react';
import type { Role } from '@maxr/shared';
import { getUsers, UsersApiError } from '../api/usersApi';
import type {
  UserAccount,
  UserFilters,
  UserListQuery,
  UserListResponse,
  UserSortField,
} from '../types';

export interface UseUsersResult {
  users: UserAccount[];
  meta: UserListResponse['meta'];
  isLoading: boolean;
  error: UsersApiError | null;
  filters: UserFilters;
  page: number;
  pageSize: number;
  sortBy: UserSortField;
  sortOrder: 'asc' | 'desc';
  setSearch: (search: string) => void;
  setRole: (role: Role | '') => void;
  setIsActive: (isActive: boolean | '') => void;
  setSort: (field: UserSortField, order?: 'asc' | 'desc') => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
}

export function useUsers(initialQuery: Partial<UserListQuery> = {}): UseUsersResult {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [meta, setMeta] = useState<UserListResponse['meta']>({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<UsersApiError | null>(null);

  const [search, setSearchState] = useState<string>(initialQuery.search || '');
  const [role, setRoleState] = useState<Role | ''>(initialQuery.role || '');
  const [isActive, setIsActiveState] = useState<boolean | ''>(
    initialQuery.isActive !== undefined ? initialQuery.isActive : '',
  );
  const [page, setPageState] = useState<number>(initialQuery.page || 1);
  const [pageSize, setPageSizeState] = useState<number>(initialQuery.pageSize || 10);
  const [sortBy, setSortByState] = useState<UserSortField>(initialQuery.sortBy || 'name');
  const [sortOrder, setSortOrderState] = useState<'asc' | 'desc'>(initialQuery.sortOrder || 'asc');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getUsers({
        search,
        role: role || undefined,
        isActive: isActive === '' ? undefined : isActive,
        page,
        pageSize,
        sortBy,
        sortOrder,
      });
      setUsers(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (err instanceof UsersApiError) {
        setError(err);
      } else {
        setError(new UsersApiError(500, err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, role, isActive, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const setSearch = useCallback((val: string) => {
    setSearchState(val);
    setPageState(1);
  }, []);

  const setRole = useCallback((val: Role | '') => {
    setRoleState(val);
    setPageState(1);
  }, []);

  const setIsActive = useCallback((val: boolean | '') => {
    setIsActiveState(val);
    setPageState(1);
  }, []);

  const setSort = useCallback(
    (field: UserSortField, order?: 'asc' | 'desc') => {
      if (order) {
        setSortOrderState(order);
      } else {
        setSortOrderState((prev) => (sortBy === field && prev === 'asc' ? 'desc' : 'asc'));
      }
      setSortByState(field);
      setPageState(1);
    },
    [sortBy],
  );

  const setPage = useCallback((p: number) => {
    setPageState(p);
  }, []);

  const setPageSize = useCallback((ps: number) => {
    setPageSizeState(ps);
    setPageState(1);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchState('');
    setRoleState('');
    setIsActiveState('');
    setPageState(1);
  }, []);

  return {
    users,
    meta,
    isLoading,
    error,
    filters: { search, role, isActive },
    page,
    pageSize,
    sortBy,
    sortOrder,
    setSearch,
    setRole,
    setIsActive,
    setSort,
    setPage,
    setPageSize,
    resetFilters,
    refetch: fetchUsers,
  };
}

