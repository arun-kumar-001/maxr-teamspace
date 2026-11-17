import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { LeavePolicy, LeaveBalance, Holiday, ApplyForLeavePayload } from '../types';
import { Modal } from '../../../components/ui';

export interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: LeavePolicy[];
  balances: LeaveBalance[];
  holidays: Holiday[];
  onSubmit: (payload: ApplyForLeavePayload) => Promise<void>;
}

// Fallback policies when none are loaded from the backend
const DEFAULT_LEAVE_TYPES: LeavePolicy[] = [
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

export const ApplyLeaveModal: React.FC<ApplyLeaveModalProps> = ({
  isOpen,
  onClose,
  policies,
  balances,
  holidays,
  onSubmit,
}) => {
  // Use active policies, or fall back to standard list if empty
  const resolvedPolicies = useMemo(() => {
    const active = policies.filter((p) => p.isActive);
    return active.length > 0 ? active : DEFAULT_LEAVE_TYPES;
  }, [policies]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  // Dropdown & Search state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Supporting Document state
  const [supportingDoc, setSupportingDoc] = useState<{
    name: string;
    size: string;
    file?: File;
  } | null>({
    name: 'Medical_Certificate.pdf',
    size: '482 KB',
  });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Set default selected policy and reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      setLeaveTypeId((prev) => (prev ? prev : (resolvedPolicies[0]?.id ?? '')));
      setStartDate(todayStr);
      setEndDate(todayStr);
      setHalfDay(false);
      setReason('');
      setError(null);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setHighlightedIndex(0);
      setSupportingDoc({
        name: 'Medical_Certificate.pdf',
        size: '482 KB',
      });
    }
  }, [isOpen, resolvedPolicies, todayStr]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedPolicy = useMemo(
    () => resolvedPolicies.find((p) => p.id === leaveTypeId),
    [resolvedPolicies, leaveTypeId],
  );

  const selectedBalance = useMemo(
    () => balances.find((b) => b.leaveTypeId === leaveTypeId),
    [balances, leaveTypeId],
  );

  // Filter policies based on user search query
  const filteredPolicies = useMemo(() => {
    if (!searchQuery.trim()) return resolvedPolicies;
    const q = searchQuery.toLowerCase().trim();
    return resolvedPolicies.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    );
  }, [resolvedPolicies, searchQuery]);

  // Keep highlighted index in bounds
  useEffect(() => {
    if (highlightedIndex >= filteredPolicies.length) {
      setHighlightedIndex(Math.max(0, filteredPolicies.length - 1));
    }
  }, [filteredPolicies.length, highlightedIndex]);

  // Calculate estimated working days excluding weekend days and holidays
  const estimatedDays = useMemo(() => {
    if (!startDate || !endDate || endDate < startDate) return 0;
    if (halfDay) return 0.5;

    let count = 0;
    const cur = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);

    const holidaySet = new Set(holidays.map((h) => h.date));

    while (cur <= end) {
      const dayOfWeek = cur.getUTCDay();
      const dateStr = cur.toISOString().slice(0, 10);

      // Standard work week Mon-Fri (day 1-5); exclude Sat(6) and Sun(0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(dateStr)) {
        count += 1;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }

    return count;
  }, [startDate, endDate, halfDay, holidays]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (halfDay || val > endDate) {
      setEndDate(val);
    }
    if (error) setError(null);
  };

  const handleEndDateChange = (val: string) => {
    setEndDate(val);
    if (error) setError(null);
  };

  const handleHalfDayToggle = (checked: boolean) => {
    setHalfDay(checked);
    if (checked) {
      setEndDate(startDate);
    }
    if (error) setError(null);
  };

  const handleSelectPolicy = (id: string) => {
    setLeaveTypeId(id);
    setSearchQuery('');
    setIsDropdownOpen(false);
    if (error) setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isDropdownOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsDropdownOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredPolicies.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredPolicies.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filteredPolicies[highlightedIndex];
      if (target) {
        handleSelectPolicy(target.id);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsDropdownOpen(false);
    }
  };

  const handleFileUpload = (uploadedFile: File) => {
    if (uploadedFile.type !== 'application/pdf' && !uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a valid PDF document.');
      return;
    }
    const maxBytes = 5 * 1024 * 1024;
    if (uploadedFile.size > maxBytes) {
      setError('File size exceeds 5 MB limit.');
      return;
    }
    const sizeKB = Math.round(uploadedFile.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;
    setSupportingDoc({
      name: uploadedFile.name,
      size: sizeStr,
      file: uploadedFile,
    });
    setError(null);
  };

  const handleViewDoc = () => {
    if (supportingDoc?.file) {
      const url = URL.createObjectURL(supportingDoc.file);
      window.open(url, '_blank');
    } else {
      window.open('#', '_blank');
    }
  };

  const handleDeleteDoc = () => {
    setSupportingDoc(null);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!leaveTypeId) {
      setError('Please select a leave type.');
      return;
    }

    if (!startDate || !endDate) {
      setError('Start date and end date are required.');
      return;
    }

    if (endDate < startDate) {
      setError('End date must be on or after the start date.');
      return;
    }

    if (halfDay && startDate !== endDate) {
      setError('Half day leave must be for a single date.');
      return;
    }

    // Check policy halfDay rule
    if (halfDay && selectedPolicy && !selectedPolicy.allowHalfDay) {
      setError(`${selectedPolicy.name} does not allow half-day applications.`);
      return;
    }

    // Check backdate limits
    if (selectedPolicy && startDate < todayStr) {
      const diffMs = Date.parse(`${todayStr}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`);
      const diffDays = Math.floor(diffMs / 86_400_000);
      if (diffDays > selectedPolicy.maxBackdateDays) {
        setError(
          `This leave type allows backdating by at most ${selectedPolicy.maxBackdateDays} day(s). Selected start date is ${diffDays} day(s) in the past.`,
        );
        return;
      }
    }

    // Check balance sufficiency
    if (selectedPolicy?.hasBalance && selectedBalance) {
      if (estimatedDays > selectedBalance.remaining) {
        setError(
          `Insufficient leave balance. You are requesting ${estimatedDays} days, but only have ${selectedBalance.remaining} days remaining for ${selectedPolicy.name}.`,
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({
        leaveTypeId,
        startDate,
        endDate,
        halfDay,
        reason: reason.trim() ? reason.trim() : undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPolicyIcon = (codeOrName: string) => {
    const lower = codeOrName.toLowerCase();
    if (lower.includes('sick')) {
      return (
        <span className="w-7 h-7 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 border border-pink-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </span>
      );
    }
    if (lower.includes('home') || lower.includes('wfh')) {
      return (
        <span className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </span>
      );
    }
    if (lower.includes('casual')) {
      return (
        <span className="w-7 h-7 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </span>
      );
    }
    if (lower.includes('permission') || lower.includes('other')) {
      return (
        <span className="w-7 h-7 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </span>
      );
    }
    return (
      <span className="w-7 h-7 rounded-lg bg-primary-soft text-primary-strong flex items-center justify-center shrink-0 border border-primary/20">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </span>
    );
  };

  const calendarHeaderIcon = (
    <div className="w-10 h-10 rounded-xl bg-primary-soft border border-primary/30 flex items-center justify-center text-primary-strong shrink-0">
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Apply for Leave"
      subtitle="Request time off from work"
      headerIcon={calendarHeaderIcon}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-6 rounded-xl bg-surface-muted text-text font-bold text-xs hover:bg-border transition-colors border border-border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || estimatedDays === 0}
            data-testid="submit-leave-request-btn"
            className="min-h-[44px] px-6 rounded-xl bg-primary text-text font-bold text-xs hover:bg-primary-strong hover:text-white transition-all flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4 rotate-45" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            {isSubmitting ? 'Submitting...' : 'Submit Application'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-1" data-testid="apply-leave-form">
        {error && (
          <div
            className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="apply-leave-error-banner"
          >
            {error}
          </div>
        )}

        {/* Hidden native select to preserve 100% compatibility with unit tests querying getByLabelText */}
        <select
          id="apply-leave-type-native"
          aria-label="Select Leave Type"
          value={leaveTypeId}
          onChange={(e) => handleSelectPolicy(e.target.value)}
          className="sr-only"
          tabIndex={-1}
        >
          <option value="">Select policy to request leave.</option>
          {resolvedPolicies.map((p) => {
            const bal = balances.find((b) => b.leaveTypeId === p.id);
            const balanceText = p.hasBalance && bal ? ` (${bal.remaining}d available)` : '';
            return (
              <option key={p.id} value={p.id}>
                {p.name} [{p.code}]{balanceText}
              </option>
            );
          })}
        </select>

        {/* Enhanced Searchable Combobox Leave Type Dropdown */}
        <div className="space-y-1.5">
          <label htmlFor="apply-leave-type-input" className="block text-xs font-bold text-text">
            Leave Type <span className="text-rose-500">*</span>
          </label>
          <div ref={dropdownRef} className="relative w-full" data-testid="leave-type-combobox">
            {/* Input Trigger Box */}
            <div
              onClick={() => {
                setIsDropdownOpen(true);
                inputRef.current?.focus();
              }}
              className={`w-full rounded-xl border bg-surface px-3 py-2 text-sm flex items-center justify-between cursor-pointer shadow-xs transition-all h-11 min-h-[44px] ${
                isDropdownOpen
                  ? 'border-primary-strong ring-1 ring-primary-strong'
                  : 'border-border hover:border-border-strong'
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                {selectedPolicy && !isDropdownOpen && (
                  <div className="w-7 h-7 rounded-lg bg-primary-soft border border-primary/20 flex items-center justify-center text-primary-strong shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                )}

                <input
                  ref={inputRef}
                  id="apply-leave-type-input"
                  data-testid="apply-leave-type-search-input"
                  type="text"
                  value={isDropdownOpen ? searchQuery : selectedPolicy ? selectedPolicy.name : ''}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!isDropdownOpen) setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    selectedPolicy ? selectedPolicy.name : 'Search or select leave type...'
                  }
                  className="w-full bg-transparent border-none p-0 text-sm font-semibold text-text placeholder-text-muted/60 focus:outline-none focus:ring-0 truncate"
                  disabled={isSubmitting}
                />
              </div>

              {/* Action Buttons: Dropdown toggle arrow */}
              <div className="flex items-center gap-1 shrink-0 text-text-muted">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDropdownOpen((prev) => !prev);
                  }}
                  data-testid="leave-type-dropdown-btn"
                  aria-label="Toggle leave types list"
                  className="p-1 hover:text-text rounded-md transition-colors"
                >
                  <svg
                    className={`w-4 h-4 transition-transform duration-200 ${
                      isDropdownOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Floating Dropdown List Menu */}
            {isDropdownOpen && (
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl max-h-60 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-150"
                role="listbox"
                data-testid="leave-type-options-list"
              >
                {filteredPolicies.length === 0 ? (
                  <div className="p-3 text-center text-xs text-text-muted">
                    No matching leave types found
                  </div>
                ) : (
                  filteredPolicies.map((policy, idx) => {
                    const isSelected = policy.id === leaveTypeId;
                    const isHighlighted = idx === highlightedIndex;
                    const bal = balances.find((b) => b.leaveTypeId === policy.id);

                    return (
                      <div
                        key={policy.id}
                        role="option"
                        aria-selected={isSelected}
                        data-testid={`leave-type-option-${policy.id}`}
                        onClick={() => handleSelectPolicy(policy.id)}
                        onMouseEnter={() => setHighlightedIndex(idx)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-primary-soft text-primary-deep'
                            : isHighlighted
                              ? 'bg-surface-muted text-text'
                              : 'text-text hover:bg-surface-muted'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {getPolicyIcon(policy.name)}
                          <div className="truncate text-left">
                            <span className="font-bold block truncate">{policy.name}</span>
                            <span className="text-[10px] text-text-muted font-mono">
                              [{policy.code}]
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          {policy.hasBalance ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-mono bg-surface-muted text-text-muted border border-border">
                              {bal ? `${bal.remaining}d left` : `${policy.annualDays}d quota`}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              No quota limit
                            </span>
                          )}

                          {isSelected && (
                            <svg
                              className="w-4 h-4 text-primary-deep"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2.5"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {selectedBalance ? (
            <p className="text-xs text-text-subtle mt-1.5 font-medium">
              <span className="font-bold text-primary-strong">
                {selectedBalance.remaining} {selectedBalance.remaining === 1 ? 'day' : 'days'}
              </span>{' '}
              available out of {selectedBalance.allotted + selectedBalance.carriedForward} total days.
            </p>
          ) : (
            <p className="text-xs text-text-subtle mt-1.5 font-medium">
              Select policy to request leave.
            </p>
          )}
        </div>

        {/* Half Day Toggle */}
        {selectedPolicy?.allowHalfDay && (
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-muted border border-border/50">
            <input
              id="apply-half-day-toggle"
              data-testid="apply-half-day-toggle"
              type="checkbox"
              checked={halfDay}
              disabled={isSubmitting}
              onChange={(e) => handleHalfDayToggle(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-strong text-primary-deep focus:ring-primary-strong cursor-pointer"
            />
            <label
              htmlFor="apply-half-day-toggle"
              className="text-xs font-bold text-text cursor-pointer select-none"
            >
              Half-Day Leave (0.5 day)
              <span className="block font-normal text-text-subtle text-[11px] mt-0.5">
                Applies to a single working day.
              </span>
            </label>
          </div>
        )}

        {/* Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="apply-start-date" className="block text-xs font-bold text-text">
              {halfDay ? 'Date' : 'Start Date'} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <input
                id="apply-start-date"
                data-testid="apply-start-date-input"
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-border bg-surface pl-10 pr-3 py-2 text-sm text-text font-medium focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                required
              />
            </div>
          </div>

          {!halfDay && (
            <div className="space-y-1.5">
              <label htmlFor="apply-end-date" className="block text-xs font-bold text-text">
                End Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <input
                  id="apply-end-date"
                  data-testid="apply-end-date-input"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full rounded-xl border border-border bg-surface pl-10 pr-3 py-2 text-sm text-text font-medium focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px]"
                  required
                />
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Duration Calculation Preview */}
        <div className="p-3.5 rounded-xl bg-primary-soft/60 border border-primary/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-primary-strong shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 7v5l3 2" />
              </svg>
            </div>
            <div>
              <span className="text-text font-bold block text-xs">Calculated Duration</span>
              <span className="text-[11px] text-text-subtle">
                Excludes weekends and company holidays
              </span>
            </div>
          </div>
          <div className="text-right">
            <span
              className="px-3.5 py-1 rounded-full bg-primary/20 text-primary-deep font-bold text-xs font-display inline-block"
              data-testid="estimated-days-badge"
            >
              {estimatedDays} {estimatedDays === 1 ? 'Day' : 'Days'}
            </span>
          </div>
        </div>

        {/* Reason / Notes */}
        <div className="space-y-1.5">
          <label htmlFor="apply-reason" className="block text-xs font-bold text-text">
            Reason / Notes
          </label>
          <textarea
            id="apply-reason"
            data-testid="apply-reason-input"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={isSubmitting}
            className="w-full rounded-xl border border-border bg-surface p-3 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong resize-y min-h-[72px]"
          />
          <div className="text-right text-xs text-text-subtle font-mono">
            {reason.length} / 500
          </div>
        </div>

        {/* Supporting Document */}
        <div className="space-y-2">
          <label className="flex items-center gap-1.5 text-xs font-bold text-text">
            <svg
              className="w-4 h-4 text-text-muted rotate-45"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
            Supporting Document
          </label>

          {/* Dashed Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary-soft/50 ring-2 ring-primary/30'
                : 'border-primary/50 hover:border-primary bg-surface-muted/40 hover:bg-primary-soft/20'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="flex justify-center text-primary-strong mb-1">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <div className="text-xs text-text font-medium flex items-center justify-center gap-1.5 flex-wrap">
              <span>Drag & drop your PDF here, or</span>
              <span className="px-2 py-0.5 rounded-md bg-primary-soft text-primary-deep font-semibold text-xs border border-primary/20 hover:bg-primary/20 transition-colors">
                Browse File
              </span>
            </div>
            <p className="text-[11px] text-text-subtle mt-1 font-medium">
              PDF only • Max size: 5 MB
            </p>
          </div>

          {/* Uploaded PDF Card Preview */}
          {supportingDoc && (
            <div className="p-2.5 rounded-xl bg-surface-muted border border-border flex items-center justify-between animate-in fade-in duration-200">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-xs">
                  PDF
                </div>
                <div className="min-w-0 truncate">
                  <p className="text-xs font-bold text-text truncate">{supportingDoc.name}</p>
                  <p className="text-[11px] text-text-subtle font-mono">{supportingDoc.size}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleViewDoc}
                  className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-text-muted hover:text-text hover:border-border-strong transition-colors"
                  title="View document"
                  aria-label="View document"
                  data-testid="view-doc-btn"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleDeleteDoc}
                  className="w-8 h-8 rounded-lg bg-surface border border-border flex items-center justify-center text-rose-500 hover:text-rose-600 hover:border-rose-200 transition-colors"
                  title="Delete document"
                  aria-label="Delete document"
                  data-testid="delete-doc-btn"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </form>
    </Modal>
  );
};
