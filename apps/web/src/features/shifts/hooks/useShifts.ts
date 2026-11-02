import { useState, useEffect, useCallback } from 'react';
import type {
  AttendancePolicy,
  CreateShiftPayload,
  Shift,
  UpdateAttendancePolicyPayload,
  UpdateShiftPayload,
} from '../types';
import {
  fetchShifts,
  createShift,
  updateShift,
  fetchAttendancePolicy,
  updateAttendancePolicy,
} from '../api/shifts';

export function useShifts() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [policy, setPolicy] = useState<AttendancePolicy | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [shiftsData, policyData] = await Promise.all([
        fetchShifts(true),
        fetchAttendancePolicy(),
      ]);
      setShifts(shiftsData);
      setPolicy(policyData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts and policy');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreateShift = useCallback(() => {
    setSelectedShift(null);
    setIsShiftModalOpen(true);
  }, []);

  const openEditShift = useCallback((shift: Shift) => {
    setSelectedShift(shift);
    setIsShiftModalOpen(true);
  }, []);

  const closeShiftModal = useCallback(() => {
    setIsShiftModalOpen(false);
    setSelectedShift(null);
  }, []);

  const handleSaveShift = useCallback(
    async (payload: CreateShiftPayload | UpdateShiftPayload) => {
      if (selectedShift) {
        await updateShift(selectedShift.id, payload as UpdateShiftPayload);
      } else {
        await createShift(payload as CreateShiftPayload);
      }
      await loadData();
    },
    [selectedShift, loadData],
  );

  const handleUpdatePolicy = useCallback(
    async (payload: UpdateAttendancePolicyPayload) => {
      const updated = await updateAttendancePolicy(payload);
      setPolicy(updated);
      await loadData();
    },
    [loadData],
  );

  return {
    shifts,
    policy,
    isLoading,
    error,
    refetch: loadData,
    // Shift Modal
    isShiftModalOpen,
    selectedShift,
    openCreateShift,
    openEditShift,
    closeShiftModal,
    handleSaveShift,
    handleUpdatePolicy,
  };
}
