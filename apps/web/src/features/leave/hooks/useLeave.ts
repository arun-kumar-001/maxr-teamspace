import { useState, useCallback, useEffect } from 'react';
import type {
  LeavePolicy,
  CreateLeavePolicyInput,
  UpdateLeavePolicyInput,
  Holiday,
  CreateHolidayInput,
  LeaveBalance,
  AccrualResult,
  LeaveRequest,
  ApplyForLeavePayload,
  ListMyLeaveRequestsQuery,
  LeaveCalendarEntry,
} from '../types';
import * as leaveApi from '../api/leave';

export function useLeave(initialYear: number = new Date().getFullYear()) {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [calendarEntries, setCalendarEntries] = useState<LeaveCalendarEntry[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(initialYear);

  const [isLoadingPolicies, setIsLoadingPolicies] = useState(false);
  const [isLoadingHolidays, setIsLoadingHolidays] = useState(false);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  const [policyError, setPolicyError] = useState<string | null>(null);
  const [holidayError, setHolidayError] = useState<string | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);

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

  const loadMyRequests = useCallback(async (query: ListMyLeaveRequestsQuery = {}) => {
    try {
      setIsLoadingRequests(true);
      setRequestsError(null);
      const res = await leaveApi.fetchMyLeaveRequests(query);
      setRequests(res.data);
    } catch (err) {
      setRequestsError(err instanceof Error ? err.message : 'Failed to fetch leave applications');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadCalendar = useCallback(async (from: string, to: string) => {
    try {
      setIsLoadingCalendar(true);
      setCalendarError(null);
      const data = await leaveApi.fetchLeaveCalendar(from, to);
      setCalendarEntries(data);
    } catch (err) {
      setCalendarError(err instanceof Error ? err.message : 'Failed to fetch leave calendar');
    } finally {
      setIsLoadingCalendar(false);
    }
  }, []);

  const handleApplyLeave = async (payload: ApplyForLeavePayload) => {
    const created = await leaveApi.applyForLeave(payload);
    setRequests((prev) => [created, ...prev]);
    // Refresh balances after successful leave submission
    await loadBalances(selectedYear);
    return created;
  };

  const handleCancelRequest = async (id: string) => {
    const cancelled = await leaveApi.cancelLeaveRequest(id);
    setRequests((prev) => prev.map((r) => (r.id === id ? cancelled : r)));
    // Refresh balances after request cancellation
    await loadBalances(selectedYear);
    return cancelled;
  };

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
    loadMyRequests();

    // Load initial calendar window covering full current month through end of next month
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromStr = `${monthStart.getFullYear()}-${pad(monthStart.getMonth() + 1)}-${pad(monthStart.getDate())}`;
    const toStr = `${nextMonthEnd.getFullYear()}-${pad(nextMonthEnd.getMonth() + 1)}-${pad(nextMonthEnd.getDate())}`;
    loadCalendar(fromStr, toStr);
  }, [loadPolicies, loadHolidays, loadBalances, loadMyRequests, loadCalendar, selectedYear]);

  return {
    policies,
    holidays,
    balances,
    requests,
    calendarEntries,
    selectedYear,
    setSelectedYear: handleYearChange,
    isLoadingPolicies,
    isLoadingHolidays,
    isLoadingBalances,
    isLoadingRequests,
    isLoadingCalendar,
    policyError,
    holidayError,
    balanceError,
    requestsError,
    calendarError,
    loadPolicies,
    loadHolidays,
    loadBalances,
    loadMyRequests,
    loadCalendar,
    applyLeave: handleApplyLeave,
    cancelRequest: handleCancelRequest,
    createPolicy: handleCreatePolicy,
    updatePolicy: handleUpdatePolicy,
    createHoliday: handleCreateHoliday,
    deleteHoliday: handleDeleteHoliday,
    runAccrual: handleRunAccrual,
  };
}
