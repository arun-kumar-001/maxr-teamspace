import { useCallback, useEffect, useState } from 'react';
import { fetchEmployeeDetail, updateEmployeeDetail, EmployeeDetailApiError } from '../api/detail';
import type { EmployeeDetail, EmployeePatch } from '../types';

export interface UseEmployeeDetailResult {
  employee: EmployeeDetail | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  statusCode: number | null;
  isConflict: boolean;
  isNotFound: boolean;
  isForbidden: boolean;
  fieldErrors: Record<string, string>;
  refetch: () => Promise<void>;
  updateEmployee: (patch: EmployeePatch) => Promise<{
    success: boolean;
    employee?: EmployeeDetail;
    error?: string;
    statusCode?: number;
    details?: unknown;
  }>;
  clearError: () => void;
}

export function useEmployeeDetail(employeeId: string | undefined): UseEmployeeDetailResult {
  const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const loadDetail = useCallback(
    async (signal?: AbortSignal) => {
      if (!employeeId) {
        setIsLoading(false);
        setEmployee(null);
        setError('No employee ID provided');
        setStatusCode(400);
        return;
      }

      setIsLoading(true);
      setError(null);
      setStatusCode(null);
      setFieldErrors({});

      try {
        const data = await fetchEmployeeDetail(employeeId, signal);
        setEmployee(data);
        setError(null);
        setStatusCode(200);
      } catch (err: unknown) {
        if (signal?.aborted) return;
        if (err instanceof EmployeeDetailApiError) {
          setError(err.message);
          setStatusCode(err.status);
        } else if (err instanceof Error) {
          setError(err.message);
          setStatusCode(500);
        } else {
          setError('Failed to load employee details');
          setStatusCode(500);
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [employeeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadDetail(controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadDetail]);

  const refetch = useCallback(async () => {
    await loadDetail();
  }, [loadDetail]);

  const clearError = useCallback(() => {
    setError(null);
    setStatusCode(null);
    setFieldErrors({});
  }, []);

  const updateEmployee = useCallback(
    async (
      patch: EmployeePatch,
    ): Promise<{
      success: boolean;
      employee?: EmployeeDetail;
      error?: string;
      statusCode?: number;
      details?: unknown;
    }> => {
      if (!employee) {
        return { success: false, error: 'No employee record loaded' };
      }

      setIsSaving(true);
      setError(null);
      setFieldErrors({});

      try {
        const updated = await updateEmployeeDetail(employee.id, {
          ...patch,
          version: employee.version,
        });
        setEmployee(updated);
        setIsSaving(false);
        return { success: true, employee: updated };
      } catch (err: unknown) {
        setIsSaving(false);
        if (err instanceof EmployeeDetailApiError) {
          setError(err.message);
          setStatusCode(err.status);

          // Map 422/400 problems if details array exists
          const mappedErrors: Record<string, string> = {};
          if (Array.isArray(err.details)) {
            for (const item of err.details) {
              if (item && typeof item === 'object') {
                const rec = item as Record<string, unknown>;
                const fieldName = String(rec.field || rec.path || '');
                const msg = String(rec.message || 'Invalid value');
                if (fieldName) {
                  mappedErrors[fieldName] = msg;
                }
              }
            }
          }
          setFieldErrors(mappedErrors);

          return {
            success: false,
            error: err.message,
            statusCode: err.status,
            details: err.details,
          };
        }

        const msg = err instanceof Error ? err.message : 'Failed to update employee';
        setError(msg);
        setStatusCode(500);
        return { success: false, error: msg, statusCode: 500 };
      }
    },
    [employee],
  );

  return {
    employee,
    isLoading,
    isSaving,
    error,
    statusCode,
    isConflict: statusCode === 409,
    isNotFound: statusCode === 404,
    isForbidden: statusCode === 403,
    fieldErrors,
    refetch,
    updateEmployee,
    clearError,
  };
}
