import { useCallback, useState } from 'react';
import { ApiError, deactivateEmployee } from '../api/deactivation';
import type { DeactivationResult } from '../types/deactivation';

export interface UseEmployeeDeactivationResult {
  deactivate: (employeeId: string) => Promise<DeactivationResult>;
  isDeactivating: boolean;
  result: DeactivationResult | null;
  error: string | null;
  statusCode: number | null;
  reset: () => void;
}

export function useEmployeeDeactivation(): UseEmployeeDeactivationResult {
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [result, setResult] = useState<DeactivationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const reset = useCallback(() => {
    setIsDeactivating(false);
    setResult(null);
    setError(null);
    setStatusCode(null);
  }, []);

  const deactivate = useCallback(async (employeeId: string) => {
    setIsDeactivating(true);
    setError(null);
    setStatusCode(null);
    try {
      const res = await deactivateEmployee(employeeId);
      setResult(res);
      return res;
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.status);
      } else if (err instanceof Error) {
        setError(err.message);
        setStatusCode(500);
      } else {
        setError('An unexpected error occurred during deactivation.');
        setStatusCode(500);
      }
      throw err;
    } finally {
      setIsDeactivating(false);
    }
  }, []);

  return {
    deactivate,
    isDeactivating,
    result,
    error,
    statusCode,
    reset,
  };
}
