import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  CreateDesignationPayload,
  DepartmentOption,
  Designation,
  DesignationListMeta,
  DesignationQuery,
  UpdateDesignationPayload,
} from '../types';
import {
  createDesignation,
  deactivateDesignation,
  DesignationsApiError,
  fetchDepartmentOptions,
  fetchDesignations,
  updateDesignation,
} from '../api/designationsApi';

export interface ToastState {
  variant: 'success' | 'danger' | 'warning' | 'info';
  title: string;
  message?: string;
}

const DEFAULT_META: DesignationListMeta = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1,
};

export function useDesignations(initialQuery: DesignationQuery = {}) {
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [meta, setMeta] = useState<DesignationListMeta>(DEFAULT_META);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);

  // Filters and Pagination
  const [rawSearch, setRawSearch] = useState<string>(initialQuery.search ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState<string>(initialQuery.search ?? '');
  const [departmentFilter, setDepartmentFilter] = useState<string>(initialQuery.departmentId ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(
    initialQuery.isActive !== undefined ? String(initialQuery.isActive) : '',
  );
  const [page, setPage] = useState<number>(initialQuery.page ?? 1);
  const [pageSize, setPageSize] = useState<number>(initialQuery.pageSize ?? 20);
  const [sortBy, setSortBy] = useState<'title' | 'code' | 'level' | 'createdAt'>(
    initialQuery.sortBy ?? 'level',
  );
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(initialQuery.sortOrder ?? 'asc');

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDesignation, setSelectedDesignation] = useState<Designation | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalServerError, setModalServerError] = useState<string | null>(null);

  // Detail Modal
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailDesignation, setDetailDesignation] = useState<Designation | null>(null);

  // Deactivate Dialog
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [deactivatingDesignation, setDeactivatingDesignation] = useState<Designation | null>(null);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [deactivateServerError, setDeactivateServerError] = useState<string | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<ToastState | null>(null);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  // Department lookup map
  const departmentMap = useMemo(() => {
    const map = new Map<string, DepartmentOption>();
    for (const d of departments) {
      map.set(d.id, d);
    }
    return map;
  }, [departments]);

  // Load departments for forms and filters
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadDepts() {
      try {
        const data = await fetchDepartmentOptions(controller.signal);
        if (isMounted) {
          setDepartments(data);
        }
      } catch {
        // Handled gracefully
      }
    }

    loadDepts();

    return () => {
      isMounted = false;
      controller.abort();
    };
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
  }, [debouncedSearch, departmentFilter, statusFilter]);

  const fetchTriggerRef = useRef(0);

  const loadDesignations = useCallback(async () => {
    const triggerId = ++fetchTriggerRef.current;
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);

    try {
      const activeParam =
        statusFilter === 'true' ? true : statusFilter === 'false' ? false : undefined;

      const res = await fetchDesignations({
        page,
        pageSize,
        sortBy,
        sortOrder,
        search: debouncedSearch.trim() || undefined,
        departmentId: departmentFilter.trim() || undefined,
        isActive: activeParam,
      });

      if (triggerId === fetchTriggerRef.current) {
        setDesignations(res.data);
        setMeta(res.meta);
      }
    } catch (err: unknown) {
      if (triggerId === fetchTriggerRef.current) {
        if (err instanceof DesignationsApiError && err.status === 403) {
          setIsForbidden(true);
          setError(null);
        } else if (err instanceof Error) {
          setError(err);
        } else {
          setError(new Error('An unexpected error occurred while loading designations'));
        }
        setDesignations([]);
      }
    } finally {
      if (triggerId === fetchTriggerRef.current) {
        setIsLoading(false);
      }
    }
  }, [page, pageSize, sortBy, sortOrder, debouncedSearch, departmentFilter, statusFilter]);

  useEffect(() => {
    loadDesignations();
  }, [loadDesignations]);

  // Modal Handlers
  const openCreate = useCallback(() => {
    setSelectedDesignation(null);
    setModalServerError(null);
    setIsModalOpen(true);
  }, []);

  const openEdit = useCallback((designation: Designation) => {
    setSelectedDesignation(designation);
    setModalServerError(null);
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedDesignation(null);
    setModalServerError(null);
  }, []);

  const openDetail = useCallback((designation: Designation) => {
    setDetailDesignation(designation);
    setIsDetailOpen(true);
  }, []);

  const closeDetail = useCallback(() => {
    setIsDetailOpen(false);
    setDetailDesignation(null);
  }, []);

  const openDeactivate = useCallback((designation: Designation) => {
    setDeactivatingDesignation(designation);
    setDeactivateServerError(null);
    setIsDeactivateOpen(true);
  }, []);

  const closeDeactivate = useCallback(() => {
    setIsDeactivateOpen(false);
    setDeactivatingDesignation(null);
    setDeactivateServerError(null);
  }, []);

  const handleSave = useCallback(
    async (payload: CreateDesignationPayload | UpdateDesignationPayload) => {
      setIsSubmitting(true);
      setModalServerError(null);

      try {
        if (selectedDesignation) {
          await updateDesignation(selectedDesignation.id, payload);
          setToast({
            variant: 'success',
            title: 'Designation updated',
            message: `Designation '${payload.title || selectedDesignation.title}' was successfully updated.`,
          });
        } else {
          await createDesignation(payload as CreateDesignationPayload);
          setToast({
            variant: 'success',
            title: 'Designation created',
            message: `Designation '${payload.title}' was successfully created.`,
          });
        }
        closeModal();
        await loadDesignations();
      } catch (err: unknown) {
        if (err instanceof DesignationsApiError) {
          setModalServerError(err.message);
        } else if (err instanceof Error) {
          setModalServerError(err.message);
        } else {
          setModalServerError('Failed to save designation. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [selectedDesignation, closeModal, loadDesignations],
  );

  const confirmDeactivate = useCallback(async () => {
    if (!deactivatingDesignation) return;
    setIsDeactivating(true);
    setDeactivateServerError(null);

    try {
      await deactivateDesignation(deactivatingDesignation.id);
      setToast({
        variant: 'success',
        title: 'Designation deactivated',
        message: `Designation '${deactivatingDesignation.title}' has been deactivated.`,
      });
      closeDeactivate();
      await loadDesignations();
    } catch (err: unknown) {
      if (err instanceof DesignationsApiError) {
        setDeactivateServerError(err.message);
      } else if (err instanceof Error) {
        setDeactivateServerError(err.message);
      } else {
        setDeactivateServerError('Failed to deactivate designation. Please try again.');
      }
    } finally {
      setIsDeactivating(false);
    }
  }, [deactivatingDesignation, closeDeactivate, loadDesignations]);

  const resetFilters = useCallback(() => {
    setRawSearch('');
    setDebouncedSearch('');
    setDepartmentFilter('');
    setStatusFilter('');
    setPage(1);
  }, []);

  const setSort = useCallback(
    (key: 'title' | 'code' | 'level' | 'createdAt', direction: 'asc' | 'desc') => {
      setSortBy(key);
      setSortOrder(direction);
    },
    [],
  );

  return {
    designations,
    departments,
    departmentMap,
    meta,
    isLoading,
    error,
    isForbidden,
    search: rawSearch,
    departmentFilter,
    statusFilter,
    page,
    pageSize,
    sortBy,
    sortOrder,
    setSearch: setRawSearch,
    setDepartmentFilter,
    setStatusFilter,
    setPage,
    setPageSize,
    setSort,
    resetFilters,
    refetch: loadDesignations,
    // Modals
    isModalOpen,
    selectedDesignation,
    isSubmitting,
    modalServerError,
    openCreate,
    openEdit,
    closeModal,
    handleSave,
    // Detail
    isDetailOpen,
    detailDesignation,
    openDetail,
    closeDetail,
    // Deactivate
    isDeactivateOpen,
    deactivatingDesignation,
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
