import { useState, useCallback, useEffect } from 'react';
import type {
  LeavePolicy,
  CreateLeavePolicyInput,
  UpdateLeavePolicyInput,
  Holiday,
  CreateHolidayInput,
  LeaveBalance,
  AccrualResult,
} from '../types';
import * as leaveApi from '../api/leave';

export function useLeave(initialYear: number = new Date().getFullYear()) {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const [policyError, setPolicyError] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    try {
      setIsLoadingPolicies(true);
      setPolicyError(null);
      const data = await leaveApi.fetchLeavePolicies();
      setPolicies(data);
    } catch (err) {
      setPolicyError(err instanceof Error ? err.message : 'Failed to fetch leave policies');
    } finally {
      setIsLoadingPolicies(false);
    }
  }, []);

  const loadHolidays = useCallback(async (year: number) => {
    try {
      setIsLoadingHolidays(true);
      setHolidayError(null);
      const data = await leaveApi.fetchHolidays(year);
      setHolidays(data);
    } catch (err) {
      setHolidayError(err instanceof Error ? err.message : 'Failed to fetch company holidays');
    } finally {
      setIsLoadingHolidays(false);
    }
  }, []);

  const loadBalances = useCallback(async (year: number) => {
    try {
      setIsLoadingBalances(true);
      setBalanceError(null);
      const data = await leaveApi.fetchMyLeaveBalances(year);
      setBalances(data);
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : 'Failed to fetch leave balances');
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  const handleCreatePolicy = async (payload: CreateLeavePolicyInput) => {
    const created = await leaveApi.createLeavePolicy(payload);
    setPolicies((prev) => [...prev, created]);
    return created;
  };

  const handleUpdatePolicy = async (id: string, payload: UpdateLeavePolicyInput) => {
    const updated = await leaveApi.updateLeavePolicy(id, payload);
    setPolicies((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const handleCreateHoliday = async (payload: CreateHolidayInput) => {
    const created = await leaveApi.createHoliday(payload);
    setHolidays((prev) => [...prev, created]);
    return created;
  };

  const handleDeleteHoliday = async (id: string) => {
    await leaveApi.deleteHoliday(id);
    setHolidays((prev) => prev.filter((h) => h.id !== id));
  };

  const handleRunAccrual = async (year: number): Promise<AccrualResult> => {
    const res = await leaveApi.runYearlyAccrual(year);
    // Refresh balances if target year matches
    if (year === selectedYear) {
      await loadBalances(year);
    }
    return res;
  };

  const handleYearChange = (newYear: number) => {
    setSelectedYear(newYear);
    loadHolidays(newYear);
    loadBalances(newYear);
  };

  useEffect(() => {
    loadPolicies();
    loadHolidays(selectedYear);
    loadBalances(selectedYear);
  }, [loadPolicies, loadHolidays, loadBalances, selectedYear]);

  return {
    policies,
    holidays,
    balances,
    selectedYear,
    setSelectedYear: handleYearChange,
    isLoadingPolicies,
    isLoadingHolidays,
    isLoadingBalances,
    policyError,
    holidayError,
    balanceError,
    loadPolicies,
    loadHolidays,
    loadBalances,
    createPolicy: handleCreatePolicy,
    updatePolicy: handleUpdatePolicy,
    createHoliday: handleCreateHoliday,
    deleteHoliday: handleDeleteHoliday,
    runAccrual: handleRunAccrual,
  };
}
