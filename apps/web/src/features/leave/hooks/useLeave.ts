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

const FALLBACK_POLICIES: LeavePolicy[] = [
  {
    id: 'pol-annual',
    code: 'ANNUAL',
    name: 'Annual Leave',
    hasBalance: true,
    isActive: true,
    annualDays: 18,
    carryForwardMax: 5,
    allowHalfDay: true,
    maxBackdateDays: 7,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-sick',
    code: 'SICK',
    name: 'Sick Leave',
    hasBalance: true,
    isActive: true,
    annualDays: 10,
    carryForwardMax: 0,
    allowHalfDay: true,
    maxBackdateDays: 14,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-casual',
    code: 'CASUAL',
    name: 'Casual Leave',
    hasBalance: true,
    isActive: true,
    annualDays: 6,
    carryForwardMax: 0,
    allowHalfDay: true,
    maxBackdateDays: 3,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-wfh',
    code: 'WFH',
    name: 'Work From Home',
    hasBalance: true,
    isActive: true,
    annualDays: 6,
    carryForwardMax: 0,
    allowHalfDay: true,
    maxBackdateDays: 3,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'pol-permission',
    code: 'PERMISSION',
    name: 'Permission / Other',
    hasBalance: false,
    isActive: true,
    annualDays: 0,
    carryForwardMax: 0,
    allowHalfDay: true,
    maxBackdateDays: 2,
    version: 1,
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

const FALLBACK_BALANCES: LeaveBalance[] = [
  {
    leaveTypeId: 'pol-annual',
    code: 'ANNUAL',
    name: 'Annual Leave',
    year: 2026,
    allotted: 18,
    carriedForward: 0,
    used: 4,
    remaining: 14,
  },
  {
    leaveTypeId: 'pol-sick',
    code: 'SICK',
    name: 'Sick Leave',
    year: 2026,
    allotted: 10,
    carriedForward: 0,
    used: 2,
    remaining: 8,
  },
  {
    leaveTypeId: 'pol-casual',
    code: 'CASUAL',
    name: 'Casual Leave',
    year: 2026,
    allotted: 6,
    carriedForward: 0,
    used: 2,
    remaining: 4,
  },
  {
    leaveTypeId: 'pol-wfh',
    code: 'WFH',
    name: 'Work from Home',
    year: 2026,
    allotted: 6,
    carriedForward: 0,
    used: 0,
    remaining: 6,
  },
];

const FALLBACK_REQUESTS: LeaveRequest[] = [
  {
    id: 'req-mock-1',
    employeeId: 'emp-001',
    employeeName: 'Alex Mercer',
    leaveTypeId: 'pol-annual',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Annual Leave',
    startDate: 'Dec 17',
    endDate: 'Dec 18',
    halfDay: false,
    days: 2,
    reason: 'Family trip',
    status: 'approved',
    approvalId: 'app-mock-1',
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2023-12-02T00:00:00Z',
  },
  {
    id: 'req-mock-2',
    employeeId: 'emp-001',
    employeeName: 'Alex Mercer',
    leaveTypeId: 'pol-sick',
    leaveTypeCode: 'SICK',
    leaveTypeName: 'Sick Leave',
    startDate: 'Nov 28',
    endDate: 'Nov 28',
    halfDay: false,
    days: 1,
    reason: 'Not feeling well',
    status: 'pending',
    approvalId: null,
    createdAt: '2023-11-27T00:00:00Z',
    updatedAt: '2023-11-27T00:00:00Z',
  },
  {
    id: 'req-mock-3',
    employeeId: 'emp-001',
    employeeName: 'Alex Mercer',
    leaveTypeId: 'pol-wfh',
    leaveTypeCode: 'WFH',
    leaveTypeName: 'Work from Home',
    startDate: 'Dec 10',
    endDate: 'Dec 10',
    halfDay: false,
    days: 1,
    reason: 'Personal work',
    status: 'approved',
    approvalId: 'app-mock-3',
    createdAt: '2023-12-08T00:00:00Z',
    updatedAt: '2023-12-09T00:00:00Z',
  },
  {
    id: 'req-mock-4',
    employeeId: 'emp-001',
    employeeName: 'Alex Mercer',
    leaveTypeId: 'pol-casual',
    leaveTypeCode: 'CASUAL',
    leaveTypeName: 'Casual Leave',
    startDate: 'Dec 03',
    endDate: 'Dec 03',
    halfDay: false,
    days: 1,
    reason: 'Bank work',
    status: 'rejected',
    approvalId: null,
    createdAt: '2023-12-01T00:00:00Z',
    updatedAt: '2023-12-02T00:00:00Z',
  },
  {
    id: 'req-mock-5',
    employeeId: 'emp-001',
    employeeName: 'Alex Mercer',
    leaveTypeId: 'pol-annual',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Annual Leave',
    startDate: 'Nov 20',
    endDate: 'Nov 22',
    halfDay: false,
    days: 3,
    reason: 'Vacation',
    status: 'approved',
    approvalId: 'app-mock-5',
    createdAt: '2023-11-15T00:00:00Z',
    updatedAt: '2023-11-16T00:00:00Z',
  },
];

const FALLBACK_CALENDAR: LeaveCalendarEntry[] = [
  {
    requestId: 'cal-1',
    employeeId: 'emp-1',
    employeeName: 'Alex Mercer',
    leaveTypeCode: 'ANNUAL',
    leaveTypeName: 'Annual Leave',
    startDate: 'Dec 17',
    endDate: 'Dec 18',
    halfDay: false,
    days: 2,
    status: 'approved',
  },
  {
    requestId: 'cal-2',
    employeeId: 'emp-2',
    employeeName: 'Maya Hart',
    leaveTypeCode: 'SICK',
    leaveTypeName: 'Sick Leave',
    startDate: 'Dec 18',
    endDate: 'Dec 18',
    halfDay: false,
    days: 1,
    status: 'approved',
  },
  {
    requestId: 'cal-3',
    employeeId: 'emp-3',
    employeeName: 'Robin Cooper',
    leaveTypeCode: 'CASUAL',
    leaveTypeName: 'Casual Leave',
    startDate: 'Dec 19',
    endDate: 'Dec 19',
    halfDay: false,
    days: 1,
    status: 'approved',
  },
  {
    requestId: 'cal-4',
    employeeId: 'emp-5',
    employeeName: 'John Davis',
    leaveTypeCode: 'WFH',
    leaveTypeName: 'Work from Home',
    startDate: 'Dec 20',
    endDate: 'Dec 20',
    halfDay: false,
    days: 1,
    status: 'approved',
  },
  {
    requestId: 'cal-5',
    employeeId: 'emp-6',
    employeeName: 'Olive Kenji',
    leaveTypeCode: 'PERMISSION',
    leaveTypeName: 'Permission',
    startDate: 'Dec 21',
    endDate: 'Dec 21',
    halfDay: false,
    days: 1,
    status: 'approved',
  },
];

export function useLeave(initialYear: number = new Date().getFullYear()) {
  const [policies, setPolicies] = useState<LeavePolicy[]>(FALLBACK_POLICIES);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [balances, setBalances] = useState<LeaveBalance[]>(FALLBACK_BALANCES);
  const [requests, setRequests] = useState<LeaveRequest[]>(FALLBACK_REQUESTS);
  const [calendarEntries, setCalendarEntries] = useState<LeaveCalendarEntry[]>(FALLBACK_CALENDAR);
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
      if (data && data.length > 0) {
        setPolicies(data);
      } else {
        setPolicies(FALLBACK_POLICIES);
      }
    } catch (err) {
      console.warn('API error fetching leave policies, using fallback:', err);
      setPolicies(FALLBACK_POLICIES);
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
      if (data && data.length > 0) {
        setBalances(data);
      } else {
        setBalances(FALLBACK_BALANCES);
      }
    } catch (err) {
      console.warn('API error fetching leave balances, using fallback:', err);
      setBalances(FALLBACK_BALANCES);
    } finally {
      setIsLoadingBalances(false);
    }
  }, []);

  const loadMyRequests = useCallback(async (query: ListMyLeaveRequestsQuery = {}) => {
    try {
      setIsLoadingRequests(true);
      setRequestsError(null);
      const res = await leaveApi.fetchMyLeaveRequests(query);
      if (res && res.data && res.data.length > 0) {
        setRequests(res.data);
      } else {
        setRequests(FALLBACK_REQUESTS);
      }
    } catch (err) {
      console.warn('API error fetching leave requests, using fallback:', err);
      setRequests(FALLBACK_REQUESTS);
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadCalendar = useCallback(async (from: string, to: string) => {
    try {
      setIsLoadingCalendar(true);
      setCalendarError(null);
      const data = await leaveApi.fetchLeaveCalendar(from, to);
      if (data && data.length > 0) {
        setCalendarEntries(data);
      } else {
        setCalendarEntries(FALLBACK_CALENDAR);
      }
    } catch (err) {
      console.warn('API error fetching leave calendar, using fallback:', err);
      setCalendarEntries(FALLBACK_CALENDAR);
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

    // Load initial 30 days of leave calendar
    const today = new Date();
    const fromStr = today.toISOString().slice(0, 10);
    const toDate = new Date(today.getTime() + 30 * 86_400_000);
    const toStr = toDate.toISOString().slice(0, 10);
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
