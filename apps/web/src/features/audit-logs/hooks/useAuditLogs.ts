import { useState, useEffect, useCallback, useRef } from 'react';
import { getAuditLogs, AuditLogsApiError } from '../api/auditLogsApi';
import type {
  AuditLogFilters,
  AuditLogItem,
  AuditLogPaginationMeta,
  AuditLogQuery,
} from '../types';

export interface UseAuditLogsResult {
  items: AuditLogItem[];
  meta: AuditLogPaginationMeta;
  isLoading: boolean;
  error: string | null;
  query: AuditLogQuery;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setSortOrder: (sortOrder: 'asc' | 'desc') => void;
  updateFilters: (filters: Partial<AuditLogFilters>) => void;
  resetFilters: () => void;
  refetch: () => Promise<void>;
}

const DEFAULT_QUERY: AuditLogQuery = {
  page: 1,
  pageSize: 50,
  sortOrder: 'desc',
};

export function useAuditLogs(initialQuery: Partial<AuditLogQuery> = {}): UseAuditLogsResult {
  const [query, setQuery] = useState<AuditLogQuery>({
    ...DEFAULT_QUERY,
    ...initialQuery,
  });

  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [meta, setMeta] = useState<AuditLogPaginationMeta>({
    page: 1,
    pageSize: 50,
    total: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const queryRef = useRef(query);
  queryRef.current = query;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getAuditLogs(queryRef.current);
      setItems(response.data);
      setMeta(response.meta);
    } catch (err) {
      if (err instanceof AuditLogsApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred while fetching audit logs');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs, query]);

  const setPage = useCallback((page: number) => {
    setQuery((prev) => ({ ...prev, page }));
  }, []);

  const setPageSize = useCallback((pageSize: number) => {
    setQuery((prev) => ({ ...prev, pageSize, page: 1 }));
  }, []);

  const setSortOrder = useCallback((sortOrder: 'asc' | 'desc') => {
    setQuery((prev) => ({ ...prev, sortOrder, page: 1 }));
  }, []);

  const updateFilters = useCallback((filters: Partial<AuditLogFilters>) => {
    setQuery((prev) => {
      const next: AuditLogQuery = {
        ...prev,
        ...filters,
        page: 1, // Reset to first page on filter change
      };
      // Backend rejects both action and module
      if (filters.action && filters.action.trim()) {
        delete next.module;
      } else if (filters.module && filters.module.trim()) {
        delete next.action;
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setQuery({
      page: 1,
      pageSize: 50,
      sortOrder: 'desc',
    });
  }, []);

  return {
    items,
    meta,
    isLoading,
    error,
    query,
    setPage,
    setPageSize,
    setSortOrder,
    updateFilters,
    resetFilters,
    refetch: fetchLogs,
  };
}
