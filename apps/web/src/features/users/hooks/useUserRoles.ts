import { useCallback, useState } from 'react';
import type { Role } from '@maxr/shared';
import { updateUserRoles, UsersApiError } from '../api/usersApi';
import type { UserAccount } from '../types';

export interface UseUserRolesResult {
  updateRoles: (userId: string, roles: readonly Role[]) => Promise<UserAccount>;
  isUpdating: boolean;
  error: string | null;
  statusCode: number | null;
  errorCode?: string;
  reset: () => void;
}

export function useUserRoles(): UseUserRolesResult {
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [errorCode, setErrorCode] = useState<string | undefined>(undefined);

  const reset = useCallback(() => {
    setIsUpdating(false);
    setError(null);
    setStatusCode(null);
    setErrorCode(undefined);
  }, []);

  const updateRoles = useCallback(
    async (userId: string, roles: readonly Role[]): Promise<UserAccount> => {
      setIsUpdating(true);
      setError(null);
      setStatusCode(null);
      setErrorCode(undefined);

      try {
        const updatedUser = await updateUserRoles(userId, roles);
        return updatedUser;
      } catch (err) {
        if (err instanceof UsersApiError) {
          setError(err.message);
          setStatusCode(err.status);
          setErrorCode(err.code);
        } else {
          const fallback = err instanceof Error ? err.message : 'Failed to update roles';
          setError(fallback);
          setStatusCode(500);
        }
        throw err;
      } finally {
        setIsUpdating(false);
      }
    },
    [],
  );

  return {
    updateRoles,
    isUpdating,
    error,
    statusCode,
    errorCode,
    reset,
  };
}
