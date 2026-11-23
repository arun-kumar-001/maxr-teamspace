import React, { useState, useEffect, useMemo } from 'react';
import type { LeaveBalance, EmployeeLeaveBalance, LeavePolicy } from '../types';
import { fetchLeaveBalances } from '../api/leave';
import { useAuth } from '../../../auth/AuthContext';
import { fetchEmployeeDirectory } from '../../employees/api/employees';
import type { EmployeeDirectoryItem } from '../../employees/types';

export interface LeaveBalancesSummaryProps {
  balances: LeaveBalance[];
  /** The leave types set up in Leave Setup. Each active one gets a card, with or without a balance. */
  policies?: LeavePolicy[];
  year: number;
  onYearChange?: (year: number) => void;
  isLoading?: boolean;
  onApplyClick?: () => void;
}

function totalOf(balance: LeaveBalance): number {
  return balance.allotted + balance.carriedForward;
}

function remainingOf(balance: LeaveBalance): number {
  return Math.max(0, totalOf(balance) - balance.used);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;
}

const YearArrow: React.FC<{ direction: 'prev' | 'next' }> = ({ direction }) => (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d={direction === 'prev' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
    />
  </svg>
);

interface LeaveCard {
  key: string;
  code: string;
  name: string;
  balance: LeaveBalance | null;
  note: string | null;
}

/**
 * One card per active leave type from Leave Setup. A type with no yearly balance (a short
 * permission, unpaid leave) still shows, so the page matches what can be applied for. A type that
 * was switched off stays only while some of it was used.
 */
function buildCards(balances: LeaveBalance[], policies?: LeavePolicy[]): LeaveCard[] {
  const fromBalance = (b: LeaveBalance): LeaveCard => ({
    key: b.leaveTypeId,
    code: b.code,
    name: b.name,
    balance: b,
    note: null,
  });
  if (!policies) return balances.map(fromBalance);

  const cards: LeaveCard[] = [];
  const seen = new Set<string>();
  for (const policy of policies.filter((p) => p.isActive)) {
    const balance = balances.find((b) => b.leaveTypeId === policy.id || b.code === policy.code);
    seen.add(policy.code);
    if (balance) cards.push(fromBalance(balance));
    else
      cards.push({
        key: policy.id,
        code: policy.code,
        name: policy.name,
        balance: null,
        note: policy.hasBalance
          ? 'No balance allotted for this year yet'
          : 'No yearly limit. Apply when needed; approval is required.',
      });
  }
  for (const balance of balances) {
    if (!seen.has(balance.code) && balance.used > 0) cards.push(fromBalance(balance));
  }
  return cards.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every number here comes from the server's balances, which exist only for leave types created in
 * Leave Setup. Nothing is invented: no balances means an honest empty state.
 */
export const LeaveBalancesSummary: React.FC<LeaveBalancesSummaryProps> = ({
  balances,
  policies,
  year,
  onYearChange,
  isLoading = false,
  onApplyClick,
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

  // Compute cards and totals from active leave policies and user balances
  const cards = buildCards(balances, policies);
  const counted = cards.flatMap((c) => (c.balance ? [c.balance] : []));
  const totalDays = counted.reduce((sum, b) => sum + totalOf(b), 0);
  const usedDays = counted.reduce((sum, b) => sum + b.used, 0);
  const availableDays = counted.reduce((sum, b) => sum + remainingOf(b), 0);

  return (
    <div className="space-y-6" data-testid="leave-balances-summary">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold font-display text-text">
            My Leave Balances
          </h2>
          <p className="text-xs sm:text-sm text-text-muted mt-0.5">
            Leave types come from Leave Setup. Check what is left for {year}.
          </p>
        </div>

        {onYearChange && (
          <div className="flex items-center border border-border rounded-xl bg-surface p-1 shadow-xs self-start sm:self-auto">
            <button
              type="button"
              onClick={() => onYearChange(year - 1)}
              data-testid="balance-prev-year-btn"
              aria-label="Previous year"
              className="p-2 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <YearArrow direction="prev" />
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
              className="p-2 hover:bg-surface-muted rounded text-text-muted hover:text-text transition-colors"
            >
              <YearArrow direction="next" />
            </button>
          </div>
        )}
      </div>

      {isLoading && cards.length === 0 ? (
        <p role="status" className="text-sm text-text-muted" data-testid="leave-balances-loading">
          Loading your leave balances…
        </p>
      ) : cards.length === 0 ? (
        <div
          className="p-8 bg-surface rounded-card border border-dashed border-border text-center space-y-2"
          data-testid="leave-balances-empty"
        >
          <h3 className="text-base font-bold text-text font-display">No leave balances yet</h3>
          <p className="text-sm text-text-muted max-w-prose mx-auto">
            Balances appear here for each leave type with a yearly allowance set up in Leave Setup.
            Nothing has been set up for {year} yet.
          </p>
          {onApplyClick && (
            <button
              type="button"
              onClick={onApplyClick}
              className="mt-2 min-h-[44px] px-4 rounded-control bg-primary-deep text-white text-sm font-semibold"
            >
              Apply for leave
            </button>
          )}
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="leave-balances-totals">
            {[
              { label: 'Total entitlement', value: totalDays },
              { label: 'Used', value: usedDays },
              { label: 'Available', value: availableDays },
            ].map((item) => (
              <div
                key={item.label}
                className="p-4 bg-surface rounded-card border border-border shadow-card"
              >
                <dt className="text-xs font-bold text-text-muted">{item.label}</dt>
                <dd className="text-2xl font-extrabold text-text font-display mt-1">
                  {item.value} <span className="text-sm font-semibold text-text-muted">days</span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="pt-4 border-t border-border/80">
            <h3 className="text-base font-bold text-text font-display mb-3">
              Leave Entitlements & Balances
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
              {cards.map((card) => {
                const { balance } = card;
                const total = balance ? totalOf(balance) : 0;
                const usedPercent = balance ? percent(balance.used, total) : 0;
                return (
                  <div
                    key={card.key}
                    className="p-4 bg-surface rounded-tile border border-border shadow-xs space-y-2"
                    data-testid={`leave-balance-card-${card.code}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-sm text-text">{card.name}</span>
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                        {card.code}
                      </span>
                    </div>
                    {balance ? (
                      <>
                        <div className="text-xs font-bold text-primary-ink font-mono">
                          {remainingOf(balance)} days left
                        </div>
                        <div
                          role="progressbar"
                          aria-label={`${balance.name} used`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={usedPercent}
                          className="h-2 rounded-full bg-surface-muted overflow-hidden"
                        >
                          <div
                            className="h-full bg-primary"
                            style={{ width: `${usedPercent}%` }}
                            data-testid={`leave-balance-bar-${card.code}`}
                          />
                        </div>
                        <div className="flex justify-between text-[11px] text-text-muted pt-1 border-t border-border/60">
                          <span>Used: {balance.used}d</span>
                          <span>Total: {total}d</span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-text-muted">{card.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
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
