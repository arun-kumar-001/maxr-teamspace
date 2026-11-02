import { useCallback, useEffect, useState } from 'react';
import { getPermissions, getRoles, UsersApiError } from '../api/usersApi';
import type { PermissionSummary, RoleSummary } from '../types';

export interface UseRolesAndPermissionsResult {
  roles: RoleSummary[];
  permissions: PermissionSummary[];
  isLoading: boolean;
  error: UsersApiError | null;
  refetch: () => Promise<void>;
}

export function useRolesAndPermissions(): UseRolesAndPermissionsResult {
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [permissions, setPermissions] = useState<PermissionSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<UsersApiError | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rolesData, permissionsData] = await Promise.all([getRoles(), getPermissions()]);
      setRoles(rolesData);
      setPermissions(permissionsData);
    } catch (err) {
      if (err instanceof UsersApiError) {
        setError(err);
      } else {
        setError(new UsersApiError(500, err instanceof Error ? err.message : 'Unknown error'));
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    roles,
    permissions,
    isLoading,
    error,
    refetch: fetchData,
  };
}

