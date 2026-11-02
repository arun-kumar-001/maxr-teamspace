import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  CreateDepartmentPayload,
  Department,
  DepartmentListMeta,
  DepartmentQuery,
  UpdateDepartmentPayload,
} from '../types';
import {
  createDepartment,
  deactivateDepartment,
  DepartmentsApiError,
  fetchDepartments,
  updateDepartment,
} from '../api/departmentsApi';

export interface ToastState {
  variant: 'success' | 'danger' | 'warning' | 'info';
  title: string;
  message?: string;
}

const DEFAULT_META: DepartmentListMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export function useDepartments(initialQuery: DepartmentQuery = {}) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [meta, setMeta] = useState<DepartmentListMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  // Filters and Pagination
  const [rawSearch, setRawSearch] = useState<string>(initialQuery.search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialQuery.search ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(
    initialQuery.isActive !== undefined ? String(initialQuery.isActive) : '',
  );
  const [page, setPage] = useState<number>(initialQuery.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(initialQuery.pageSize ?? 20);
  const [sortBy, setSortBy] = useState<'name' | 'code' | 'createdAt'>(
    initialQuery.sortBy ?? 'name',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialQuery.sortOrder ?? 'asc');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalServerError, setModalServerError] = useState<string | null>(null);

  // Detail Modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDepartment, setDetailDepartment] = useState<Department | null>(null);

  // Deactivate Dialog
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [deactivatingDepartment, setDeactivatingDepartment] = useState<Department | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateServerError, setDeactivateServerError] = useState<string | null>(null);

  // Notification Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // 300ms Debounce on Search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(rawSearch);
    }, 300);

    return () => clearTimeout(handler);
  }, [rawSearch]);

  // Reset to page 1 on search or filter change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  const fetchTriggerRef = useRef(0);

  const loadDepartments = useCallback(async () => {
    const triggerId = ++fetchTriggerRef.current;
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);

    try {
      const activeParam =
        statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined;

      const res = await fetchDepartments({
        page,
        pageSize,
        sortBy,
        sortOrder,
        search: debouncedSearch.trim() || undefined,
        isActive: activeParam,
      });

      if (triggerId === fetchTriggerRef.current) {
        setDepartments(res.data);
        setMeta(res.meta);
      }
    } catch (err: unknown) {
      if (triggerId === fetchTriggerRef.current) {
        if (err instanceof DepartmentsApiError && err.status === 403) {
          setIsForbidden(true);
          setError(null);
        } else if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error('An unexpected error occurred while loading departments'));
        }
        setDepartments([]);
      }
    } finally {
      if (triggerId === fetchTriggerRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, statusFilter]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  // Modal Handlers
  const openCreate = useCallback(() => {
    setSelectedDepartment(null);
    setModalServerError(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((department: Department) => {
    setSelectedDepartment(department);
    setModalServerError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedDepartment(null);
    setModalServerError(null);
  }, []);

  const openDetail = useCallback((department: Department) => {
    setDetailDepartment(department);
    setIsDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setDetailDepartment(null);
  }, []);

  const openDeactivate = useCallback((department: Department) => {
    setDeactivatingDepartment(department);
    setDeactivateServerError(null);
    setIsDeactivateOpen(true);
  }, []);

  const closeDeactivate = useCallback(() => {
    setIsDeactivateOpen(false);
    setDeactivatingDepartment(null);
    setDeactivateServerError(null);
  }, []);

  const handleSave = useCallback(
    async (payload: CreateDepartmentPayload | UpdateDepartmentPayload) => {
      setIsSubmitting(true);
      setModalServerError(null);

      try {
        if (selectedDepartment) {
          await updateDepartment(selectedDepartment.id, payload);
          setToast({
            variant: 'success',
            title: 'Department updated',
            message: `Department '${payload.name || selectedDepartment.name}' was successfully updated.`,
          });
        } else {
          await createDepartment(payload as CreateDepartmentPayload);
          setToast({
            variant: 'success',
            title: 'Department created',
            message: `Department '${payload.name}' was successfully created.`,
          });
        }
        closeModal();
        await loadDepartments();
      } catch (err: unknown) {
        if (err instanceof DepartmentsApiError) {
          setModalServerError(err.message);
        } else if (err instanceof Error) {
          setModalServerError(err.message);
        } else {
          setModalServerError('Failed to save department. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedDepartment, closeModal, loadDepartments],
  );

  const confirmDeactivate = useCallback(async () => {
    if (!deactivatingDepartment) return;
    setIsDeactivating(true);
    setDeactivateServerError(null);

    try {
      await deactivateDepartment(deactivatingDepartment.id);
      setToast({
        variant: 'success',
        title: 'Department deactivated',
        message: `Department '${deactivatingDepartment.name}' has been deactivated.`,
      });
      closeDeactivate();
      await loadDepartments();
    } catch (err: unknown) {
      if (err instanceof DepartmentsApiError) {
        setDeactivateServerError(err.message);
      } else if (err instanceof Error) {
        setDeactivateServerError(err.message);
      } else {
        setDeactivateServerError('Failed to deactivate department. Please try again.');
      }
    } finally {
      setIsDeactivating(false);
    }
  }, [deactivatingDepartment, closeDeactivate, loadDepartments]);

  const resetFilters = useCallback(() => {
    setRawSearch('');
    setDebouncedSearch('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const setSort = useCallback((key: 'name' | 'code' | 'createdAt', direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortOrder(direction);
  }, []);

  return {
    departments,
    meta,
    isLoading,
    error,
    isForbidden,
    search: rawSearch,
    statusFilter,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setSearch: setRawSearch,
    setStatusFilter,
    setPage,
    setPageSize,
    setSort,
    resetFilters,
    refetch: loadDepartments,
    // Modals
    isModalOpen,
    selectedDepartment,
    isSubmitting,
    modalServerError,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    // Detail
    isDetailOpen,
    detailDepartment,
    openDetail,
    closeDetail,
    // Deactivate
    isDeactivateOpen,
    deactivatingDepartment,
    isDeactivating,
    deactivateServerError,
    openDeactivate,
    closeDeactivate,
    confirmDeactivate,
    // Toast
    toast,
    dismissToast,
  };
}
