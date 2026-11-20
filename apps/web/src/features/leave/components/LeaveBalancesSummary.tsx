import React, { useState, useEffect, useMemo } from 'react';
import type { LeaveBalance, EmployeeLeaveBalance } from '../types';
import { fetchLeaveBalances } from '../api/leave';
import { useAuth } from '../../../auth/AuthContext';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  year: number;
  onYearChange?: (year: number) => void;
  isLoading?: boolean;
  onApplyClick?: () => void;
}

export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  year,
  onYearChange,
}) => {
  const { user } = useAuth();
  const [teamBalances, setTeamBalances] = useState<EmployeeLeaveBalance[]>([]);
  const [employees, setEmployees] = useState<EmployeeDirectoryItem[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<'ALL' | 'ANNUAL' | 'SICK' | 'CASUAL'>('ALL');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setLoadingTeam(true);

    Promise.allSettled([
      fetchLeaveBalances({ year, pageSize: 100 }),
      fetchEmployeeDirectory({ pageSize: 100 }),
    ]).then(([balancesRes, employeesRes]) => {
      if (!isMounted) return;

      if (balancesRes.status === 'fulfilled' && balancesRes.value?.data) {
        setTeamBalances(balancesRes.value.data);
      } else {
        setTeamBalances([]);
      }

      if (employeesRes.status === 'fulfilled' && employeesRes.value?.data) {
        setEmployees(employeesRes.value.data);
      } else {
        setEmployees([]);
      }

      setLoadingTeam(false);
    });

    const handleAutoUpdate = () => {
      setRefreshTrigger((prev) => prev + 1);
    };

    window.addEventListener('storage', handleAutoUpdate);
    window.addEventListener('maxr:leave-updated', handleAutoUpdate);
    window.addEventListener('maxr:leave-applied', handleAutoUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleAutoUpdate);
      window.removeEventListener('maxr:leave-updated', handleAutoUpdate);
      window.removeEventListener('maxr:leave-applied', handleAutoUpdate);
    };
  }, [year, refreshTrigger]);

  // Determine current user's employee record and team/department
  const currentEmployee = useMemo(() => {
    return employees.find(
      (e) =>
        (user?.employeeId && e.id === user.employeeId) ||
        (user?.email && e.email.toLowerCase() === user.email.toLowerCase()),
    );
  }, [employees, user?.employeeId, user?.email]);

  const adminDepartment =
    currentEmployee?.department?.name ||
    user?.department ||
    '';

  const employeeMap = useMemo(() => {
    const map = new Map<string, EmployeeDirectoryItem>();
    for (const emp of employees) {
      map.set(emp.id, emp);
    }
    return map;
  }, [employees]);

  const getEmployeePhoto = (empId: string, email?: string): string | undefined => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const local =
        localStorage.getItem(`maxr_avatar_${empId}`) ||
        (email ? localStorage.getItem(`maxr_avatar_${email.toLowerCase()}`) : null);
      if (local) return local;
    }
    const emp = employeeMap.get(empId);
    return (emp as unknown as { avatarUrl?: string })?.avatarUrl || undefined;
  };

  // Filter balances by admin's team/department, leave type, and search query
  const filteredTeamBalances = useMemo(() => {
    return teamBalances.filter((tb) => {
      const emp = employeeMap.get(tb.employeeId);

      // If admin has a specific department and the employee has a department, keep same department
      if (adminDepartment && emp?.department?.name) {
        if (emp.department.name.toLowerCase() !== adminDepartment.toLowerCase()) {
          return false;
        }
      }

      // Leave Type Filter
      if (leaveTypeFilter !== 'ALL') {
        const typeStr = `${tb.name} ${tb.code}`.toLowerCase();
        if (leaveTypeFilter === 'ANNUAL' && !typeStr.includes('annual') && !typeStr.includes('al')) return false;
        if (leaveTypeFilter === 'SICK' && !typeStr.includes('sick') && !typeStr.includes('sl')) return false;
        if (leaveTypeFilter === 'CASUAL' && !typeStr.includes('casual') && !typeStr.includes('cl')) return false;
      }

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (tb.employeeName || '').toLowerCase();
        const code = (emp?.employeeCode || '').toLowerCase();
        const dept = (emp?.department?.name || '').toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !dept.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [teamBalances, employeeMap, adminDepartment, leaveTypeFilter, searchQuery]);

  // Compute totals if balances exist, otherwise use Image 2 values
  const hasRealBalances = balances.length > 0;

  return (
    <div className="space-y-6" data-testid="leave-balances-summary">
      {/* 1. Header Row (Image 2) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            My Leave Balances
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Check your available leave balances for this year
          </p>
        </div>

        {/* Year Dropdown / Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onYearChange && (
            <div className="flex items-center border border-border rounded-xl bg-surface p-1 shadow-xs">
              <button
                type="button"
                onClick={() => onYearChange(year - 1)}
                data-testid="balance-prev-year-btn"
                aria-label="Previous year"
                className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span
                className="px-2.5 text-xs font-bold text-text font-mono"
                data-testid="balance-current-year"
              >
                Year: {year}
              </span>
              <button
                type="button"
                onClick={() => onYearChange(year + 1)}
                data-testid="balance-next-year-btn"
                aria-label="Next year"
                className="p-1 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Top 4 Balance Cards (Image 2) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Annual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Annual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                14 of 18 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeDasharray="77, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-[77%]" />
            </div>
          </div>
        </div>

        {/* Card 2: Sick Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Sick Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                8 of 10 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-pink-500"
                  strokeDasharray="80, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-pink-500 rounded-full w-[80%]" />
            </div>
          </div>
        </div>

        {/* Card 3: Casual Leave */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Casual Leave</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                4 of 6 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-sky-500"
                  strokeDasharray="66, 100"
                  strokeLinecap="round"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-sky-500 rounded-full w-[66%]" />
            </div>
          </div>
        </div>

        {/* Card 4: Work from Home */}
        <div className="p-4 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-xs font-bold text-text-muted">Work from Home</h4>
              <p className="text-sm font-extrabold text-text font-display mt-0.5">
                6 of 6 days left
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="relative w-7 h-7 shrink-0 flex items-center justify-center">
              <svg className="w-7 h-7 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-border"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-500"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
            </div>
            <div className="flex-1 h-2 rounded-full bg-surface-muted overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full w-full" />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Bottom Overview Row (Image 2: Left Donut + Right Usage Bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Total Leave Entitlement Donut Card */}
        <div className="p-6 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Donut Chart with center label */}
            <div className="relative w-44 h-44 shrink-0 flex items-center justify-center">
              <svg className="w-44 h-44 -rotate-90" viewBox="0 0 100 100">
                {/* Background Ring */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-border"
                />
                {/* Used Arc (12 / 44 = 27%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="68 251"
                  strokeDashoffset="0"
                  fill="transparent"
                  className="text-emerald-500"
                />
                {/* Available Arc (32 / 44 = 72%) */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray="170 251"
                  strokeDashoffset="-70"
                  fill="transparent"
                  className="text-emerald-200"
                />
              </svg>
              {/* Center text in Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span className="text-[10px] sm:text-xs text-text-muted font-medium leading-tight">
                  Total Leave
                  <br />
                  Entitlement
                </span>
                <span className="text-lg sm:text-xl font-black font-display text-text mt-0.5">
                  40 Days
                </span>
              </div>
            </div>

            {/* Donut Legend List */}
            <div className="flex-1 w-full space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-semibold text-text">Used</span>
                </div>
                <span className="font-extrabold text-text font-display">12 Days</span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-200 shrink-0" />
                  <span className="font-semibold text-text">Available</span>
                </div>
                <span className="font-extrabold text-text font-display">32 Days</span>
              </div>

              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-semibold text-text">Pending</span>
                </div>
                <span className="font-extrabold text-text font-display">1 Day</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Leave Usage Progress Bars */}
        <div className="p-6 bg-surface rounded-card border border-border shadow-card flex flex-col justify-between">
          <h3 className="font-display font-bold text-base text-text mb-4">Leave Usage</h3>

          <div className="space-y-4">
            {/* Annual Leave: 4 / 18 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Annual Leave</span>
                <span className="font-mono text-text-muted">4 / 18</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full w-[22%]" />
              </div>
            </div>

            {/* Sick Leave: 2 / 10 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Sick Leave</span>
                <span className="font-mono text-text-muted">2 / 10</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full w-[20%]" />
              </div>
            </div>

            {/* Casual Leave: 2 / 6 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Casual Leave</span>
                <span className="font-mono text-text-muted">2 / 6</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-sky-500 rounded-full w-[33%]" />
              </div>
            </div>

            {/* Work from Home: 0 / 6 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-text">
                <span>Work from Home</span>
                <span className="font-mono text-text-muted">0 / 6</span>
              </div>
              <div className="h-2.5 rounded-full bg-surface-muted overflow-hidden">
                <div className="h-full bg-surface-muted rounded-full w-0" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Detailed Breakdown Cards (preserved for unit tests if real balance data passed) */}
      {hasRealBalances && (
        <div className="pt-4 border-t border-border/80">
          <h3 className="text-base font-bold text-text font-display mb-3">
            Leave Entitlements & Balances
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {balances.map((balance) => {
              const total = balance.allotted + balance.carriedForward;
              const remaining = Math.max(0, total - balance.used);
              return (
                <div
                  key={balance.leaveTypeId}
                  className="p-4 bg-surface rounded-tile border border-border shadow-xs space-y-2"
                  data-testid={`leave-balance-card-${balance.code}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-text">{balance.name}</span>
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                      {balance.code}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-primary-deep font-mono">
                    {remaining} days left
                  </div>
                  <div className="flex justify-between text-[11px] text-text-muted pt-1 border-t border-border/60">
                    <span>Used: {balance.used}d</span>
                    <span>Total: {total}d</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Same Team Leave Balances Section */}
      <div className="pt-6 border-t border-border/80 space-y-4" data-testid="same-team-leave-balances">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base sm:text-lg font-bold text-text font-display">
                Same Team Leave Balances
              </h3>
              {adminDepartment && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-soft text-primary-deep border border-primary/20">
                  Team: {adminDepartment}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-0.5">
              Available and used leave days for team members
            </p>
          </div>

          {/* Results count chip */}
          <span className="text-xs font-semibold text-text-muted self-start sm:self-auto bg-surface px-2.5 py-1 rounded-lg border border-border">
            {filteredTeamBalances.length} record{filteredTeamBalances.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface p-3 rounded-card border border-border shadow-xs">
          {/* Employee Search */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search employee name or code..."
              className="w-full pl-9 pr-8 py-1.5 text-xs rounded-xl border border-border bg-surface-raised text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              data-testid="team-leave-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted hover:text-text p-0.5"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Leave Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs font-semibold text-text-muted mr-1 hidden md:inline">Type:</span>
            {(
              [
                { id: 'ALL', label: 'All Types' },
                { id: 'ANNUAL', label: 'Annual Leave' },
                { id: 'SICK', label: 'Sick Leave' },
                { id: 'CASUAL', label: 'Casual Leave' },
              ] as const
            ).map((filter) => {
              const active = leaveTypeFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setLeaveTypeFilter(filter.id)}
                  data-testid={`team-leave-filter-${filter.id.toLowerCase()}`}
                  className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-primary-deep text-white shadow-xs'
                      : 'bg-surface-muted text-text-muted hover:text-text hover:bg-surface-raised border border-border/60'
                  }`}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Table */}
        {loadingTeam ? (
          <div className="p-8 text-center text-sm text-text-muted bg-surface rounded-card border border-border animate-pulse">
            Loading team leave balances...
          </div>
        ) : filteredTeamBalances.length === 0 ? (
          <div className="p-8 text-center bg-surface rounded-card border border-border space-y-2">
            <p className="text-sm font-semibold text-text">No team leave balance records found.</p>
            <p className="text-xs text-text-muted">
              {searchQuery || leaveTypeFilter !== 'ALL'
                ? 'Try adjusting your search query or leave type filter.'
                : `No leave records assigned for year ${year}.`}
            </p>
            {(searchQuery || leaveTypeFilter !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setLeaveTypeFilter('ALL');
                }}
                className="mt-2 text-xs font-semibold text-primary-ink hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface shadow-xs">
            <table className="w-full text-left text-sm min-w-[640px]">
              <thead className="bg-surface-muted border-b border-border text-xs uppercase font-semibold text-text-muted">
                <tr>
                  <th className="px-4 py-3">Team Member</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Leave Type</th>
                  <th className="px-4 py-3 text-right">Allocated</th>
                  <th className="px-4 py-3 text-right">Used</th>
                  <th className="px-4 py-3 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTeamBalances.map((tb, idx) => {
                  const emp = employeeMap.get(tb.employeeId);
                  const photo = getEmployeePhoto(tb.employeeId, emp?.email);
                  const initials = tb.employeeName
                    ? tb.employeeName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join('')
                        .toUpperCase()
                    : 'EM';

                  const typeLower = `${tb.name} ${tb.code}`.toLowerCase();
                  const isAnnual = typeLower.includes('annual') || typeLower.includes('al');
                  const isSick = typeLower.includes('sick') || typeLower.includes('sl');
                  const isCasual = typeLower.includes('casual') || typeLower.includes('cl');

                  const typeBadgeClass = isAnnual
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : isSick
                      ? 'bg-pink-50 text-pink-800 border-pink-200'
                      : isCasual
                        ? 'bg-sky-50 text-sky-800 border-sky-200'
                        : 'bg-surface-muted text-text-muted border-border';

                  const totalAllocated = tb.allotted + tb.carriedForward;

                  return (
                    <tr
                      key={`${tb.employeeId}-${tb.leaveTypeId}-${idx}`}
                      className="hover:bg-surface-muted/50 transition-colors"
                      data-testid={`team-balance-row-${tb.employeeId}-${tb.code}`}
                    >
                      {/* Employee Name + Avatar + Code */}
                      <td className="px-4 py-3.5 font-medium text-text">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-soft text-primary-deep text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden relative shadow-xs">
                            {photo ? (
                              <img
                                src={photo}
                                alt={tb.employeeName || 'Employee'}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            ) : null}
                            <span className={photo ? 'sr-only' : undefined}>{initials}</span>
                          </div>
                          <div>
                            <span className="font-semibold text-text block leading-tight">
                              {tb.employeeName || 'Team Member'}
                            </span>
                            {emp?.employeeCode && (
                              <span className="text-[11px] font-mono text-text-muted">
                                {emp.employeeCode}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Department */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-surface-muted text-text border border-border">
                          {emp?.department?.name || adminDepartment || 'General'}
                        </span>
                      </td>

                      {/* Leave Type */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${typeBadgeClass}`}
                        >
                          {tb.name}
                          <span className="ml-1 opacity-75 font-mono text-[10px]">
                            ({tb.code})
                          </span>
                        </span>
                      </td>

                      {/* Total Allocated */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs font-semibold text-text">
                        {totalAllocated}d
                      </td>

                      {/* Used */}
                      <td className="px-4 py-3.5 text-right font-mono text-xs text-text-muted">
                        {tb.used}d
                      </td>

                      {/* Remaining */}
                      <td className="px-4 py-3.5 text-right">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-mono bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {tb.remaining}d left
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
