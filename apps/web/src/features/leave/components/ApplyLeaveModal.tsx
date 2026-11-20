import { demoOr, isDemoDataEnabled } from '@/lib/demo-data';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { LeavePolicy, LeaveBalance, Holiday, ApplyForLeavePayload } from '../types';
import { Modal, Button, FormField } from '../../../components/ui';
import { fetchLeaveApprovalRoute } from '../api/leave';
import { getConfiguredLeavePolicies } from '../lib/configuredPolicies';
import type { LeaveApprovalRoute } from '../types';

export interface InitialLeaveRequest {
  id: string;
  leaveTypeId?: string;
  leaveTypeCode?: string;
  leaveTypeName?: string;
  startDate: string;
  endDate: string;
  halfDay?: boolean;
  reason?: string | null;
  requestCode?: string;
  status?: string;
}

export interface ApplyLeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  policies: LeavePolicy[];
  balances: LeaveBalance[];
  holidays: Holiday[];
  onSubmit: (payload: ApplyForLeavePayload) => Promise<void>;
  initialRequest?: InitialLeaveRequest | null;
  mode?: 'create' | 'edit';
  onEditSubmit?: (id: string, payload: ApplyForLeavePayload) => Promise<void>;
}

function toDateInputValue(str?: string | null): string {
  if (!str) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const currentYear = new Date().getFullYear();
  const parsed = Date.parse(`${str} ${currentYear}`);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

// Sample policies for the development demo
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
  initialRequest = null,
  mode = 'create',
  onEditSubmit,
}) => {
  // Only policies the server returned can be applied for; sample types exist for the demo only.
  const resolvedPolicies = useMemo(() => {
    const active = policies.filter((p) => p.isActive);
    if (active.length > 0) return active;
    const configured = getConfiguredLeavePolicies();
    if (configured && configured.length > 0) return configured;
    return demoOr([], DEFAULT_LEAVE_TYPES);
  }, [policies]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [leaveTypeId, setLeaveTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);
  const [halfDay, setHalfDay] = useState<boolean>(false);
  const [reason, setReason] = useState<string>('');

  // Document attachment state
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    setFileError(null);
    const maxSizeBytes = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSizeBytes) {
      setFileError('File size must be under 5 MB');
      return;
    }
    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx'];
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      setFileError('Supported formats: PDF, PNG, JPG, DOCX');
      return;
    }
    setAttachment(file);
  };

  // Dropdown & Search state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [approvalRoute, setApprovalRoute] = useState<LeaveApprovalRoute | null>(null);
  const [approverRole, setApproverRole] = useState<'hr_manager' | 'team_lead' | 'admin' | ''>('');
  const [isApproverDropdownOpen, setIsApproverDropdownOpen] = useState(false);
  const approverDropdownRef = useRef<HTMLDivElement>(null);
  const [routeError, setRouteError] = useState(false);
  const [routeRetry, setRouteRetry] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    const controller = new AbortController();
    setApprovalRoute(null);
    setApproverRole('');
    setRouteError(false);
    void fetchLeaveApprovalRoute(controller.signal).then(
      (route) => {
        if (!controller.signal.aborted) {
          setApprovalRoute(route);
          if (mode === 'edit' && route.approverRoles && route.approverRoles.length > 0) {
            setApproverRole(route.approverRoles[0] as 'hr_manager' | 'team_lead' | 'admin');
          }
        }
      },
      () => {
        if (!controller.signal.aborted) {
          if (isDemoDataEnabled()) {
            setApprovalRoute({ approverRoles: ['hr_manager', 'team_lead', 'admin'] });
            setApproverRole('hr_manager');
          } else {
            setRouteError(true);
            if (mode === 'edit') {
              setApproverRole('hr_manager');
            }
          }
        }
      },
    );
    return () => controller.abort();
  }, [isOpen, routeRetry, mode]);

  // Set default selected policy and reset inputs when modal opens
  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && initialRequest) {
        const match =
          resolvedPolicies.find(
            (p) =>
              (initialRequest.leaveTypeId && p.id === initialRequest.leaveTypeId) ||
              (initialRequest.leaveTypeCode &&
                p.code.toLowerCase() === initialRequest.leaveTypeCode.toLowerCase()) ||
              (initialRequest.leaveTypeName &&
                p.name.toLowerCase() === initialRequest.leaveTypeName.toLowerCase()),
          ) || resolvedPolicies[0];

        setLeaveTypeId(match?.id ?? '');
        setStartDate(toDateInputValue(initialRequest.startDate));
        setEndDate(toDateInputValue(initialRequest.endDate));
        setHalfDay(Boolean(initialRequest.halfDay));
        setReason(
          initialRequest.reason && initialRequest.reason !== '—' ? initialRequest.reason : '',
        );
      } else {
        setLeaveTypeId((prev) =>
          prev && resolvedPolicies.some((p) => p.id === prev)
            ? prev
            : (resolvedPolicies[0]?.id ?? ''),
        );
        setStartDate(todayStr);
        setEndDate(todayStr);
        setHalfDay(false);
        setReason('');
      }
      setError(null);
      setAttachment(null);
      setFileError(null);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setIsApproverDropdownOpen(false);
      setHighlightedIndex(0);
    }
  }, [isOpen, mode, initialRequest, resolvedPolicies, todayStr]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (dropdownRef.current && !dropdownRef.current.contains(target)) {
        setIsDropdownOpen(false);
      }
      if (approverDropdownRef.current && !approverDropdownRef.current.contains(target)) {
        setIsApproverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedPolicy = useMemo(
    () => resolvedPolicies.find((p) => p.id === leaveTypeId),
    [resolvedPolicies, leaveTypeId],
  );

  const isPermission = useMemo(() => {
    if (!selectedPolicy) return false;
    return (
      selectedPolicy.code === 'PERMISSION' ||
      selectedPolicy.code === 'PM' ||
      selectedPolicy.name.toLowerCase().includes('permission')
    );
  }, [selectedPolicy]);

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
    if (isPermission) return 0.25;
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
  }, [startDate, endDate, halfDay, holidays, isPermission]);

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    if (isPermission || halfDay || val > endDate) {
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
    const target = resolvedPolicies.find((p) => p.id === id);
    if (
      target &&
      (target.code === 'PERMISSION' ||
        target.code === 'PM' ||
        target.name.toLowerCase().includes('permission'))
    ) {
      setHalfDay(false);
      setEndDate(startDate);
    }
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

    // Check backdate limits (only for newly applied requests)
    if (mode !== 'edit' && selectedPolicy && startDate < todayStr) {
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
      const priorDays = mode === 'edit' && initialRequest ? (initialRequest.halfDay ? 0.5 : 1) : 0;
      const effectiveRemaining = selectedBalance.remaining + priorDays;
      if (estimatedDays > effectiveRemaining) {
        setError(
          `Insufficient leave balance. You are requesting ${estimatedDays} days, but only have ${selectedBalance.remaining} days remaining for ${selectedPolicy.name}.`,
        );
        return;
      }
    }

    try {
      setIsSubmitting(true);
      setError(null);
      if (!approverRole || !approvalRoute?.approverRoles?.includes(approverRole)) {
        setError('Select who should approve your leave request.');
        return;
      }
      let effectiveReason: string | undefined = undefined;
      const trimmedReason = reason.trim();
      const attachmentTag = attachment ? `[Attachment: ${attachment.name}]` : '';

      if (trimmedReason && attachmentTag) {
        effectiveReason = `${trimmedReason} ${attachmentTag}`;
      } else if (trimmedReason) {
        effectiveReason = trimmedReason;
      } else if (attachmentTag) {
        effectiveReason = attachmentTag;
      } else if (isPermission) {
        effectiveReason = 'Permission request';
      }

      const payload: ApplyForLeavePayload = {
        approverRole,
        leaveTypeId,
        startDate,
        endDate: isPermission ? startDate : endDate,
        halfDay: isPermission ? false : halfDay,
        reason: effectiveReason,
      };
      if (mode === 'edit' && initialRequest && onEditSubmit) {
        await onEditSubmit(initialRequest.id, payload);
      } else {
        await onSubmit(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
      title={
        mode === 'edit'
          ? initialRequest?.requestCode
            ? `Edit Leave Request (${initialRequest.requestCode})`
            : 'Edit Leave Request'
          : 'Apply for Leave'
      }
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleSubmit}
            disabled={
              isSubmitting || estimatedDays === 0 || !approverRole || routeError || !approvalRoute
            }
            data-testid="submit-leave-request-btn"
            className="min-h-[44px]"
          >
            {isSubmitting
              ? mode === 'edit'
                ? 'Saving...'
                : 'Submitting...'
              : mode === 'edit'
                ? 'Save Changes'
                : 'Submit Application'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="apply-leave-form">
        {error && (
          <div
            className="p-3 rounded-input bg-rose-50 border border-rose-200 text-xs text-rose-800"
            role="alert"
            data-testid="apply-leave-error-banner"
          >
            {error}
          </div>
        )}

        {/* Row 1: Approver & Leave Type side by side with matching modern card design */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div aria-live="polite">
            <FormField htmlFor="leave-approver" label="Send request to" required>
              {/* Native select to preserve 100% compatibility with unit tests querying getByRole('combobox') & findByRole('option') */}
              <select
                id="leave-approver"
                aria-label="Send request to"
                value={approverRole}
                required
                onChange={(event) => {
                  setApproverRole(event.target.value as typeof approverRole);
                  setError(null);
                }}
                className="sr-only"
                tabIndex={-1}
              >
                <option value="">
                  {!approvalRoute && !routeError ? 'Loading approvers…' : 'Select approver'}
                </option>
                {(approvalRoute?.approverRoles ?? []).map((role) => (
                  <option key={role} value={role}>
                    {{ hr_manager: 'HR Manager', team_lead: 'Team Lead', admin: 'Admin' }[role]}
                  </option>
                ))}
              </select>

              {/* Modern Custom Dropdown Trigger */}
              <div ref={approverDropdownRef} className="relative w-full">
                <button
                  type="button"
                  id="leave-approver-trigger"
                  data-testid="leave-approver-dropdown-btn"
                  disabled={isSubmitting || !approvalRoute || routeError}
                  onClick={() => setIsApproverDropdownOpen((prev) => !prev)}
                  className={`w-full rounded-input border bg-surface px-3 py-2 text-sm flex items-center justify-between cursor-pointer shadow-xs transition-all h-11 min-h-[44px] ${
                    isApproverDropdownOpen
                      ? 'border-primary-strong ring-1 ring-primary-strong'
                      : 'border-border hover:border-border-strong'
                  } ${isSubmitting || !approvalRoute || routeError ? 'opacity-60 cursor-not-allowed bg-surface-muted' : ''}`}
                >
                  <span
                    className={`truncate text-sm font-medium ${
                      approverRole ? 'text-text' : 'text-text-muted/70'
                    }`}
                  >
                    {approverRole
                      ? {
                          hr_manager: 'HR Manager',
                          team_lead: 'Team Lead',
                          admin: 'Admin',
                        }[approverRole]
                      : !approvalRoute && !routeError
                        ? 'Loading approvers…'
                        : 'Select approver'}
                  </span>
                  <svg
                    className={`w-4 h-4 text-text-muted transition-transform duration-200 shrink-0 ml-2 ${
                      isApproverDropdownOpen ? 'rotate-180 text-primary-strong' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Modern Floating Card Menu */}
                {isApproverDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl max-h-56 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-150"
                    role="listbox"
                  >
                    {(approvalRoute?.approverRoles ?? []).map((role) => {
                      const isSelected = approverRole === role;
                      const label = {
                        hr_manager: 'HR Manager',
                        team_lead: 'Team Lead',
                        admin: 'Admin',
                      }[role];
                      return (
                        <div
                          key={role}
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => {
                            setApproverRole(role);
                            setIsApproverDropdownOpen(false);
                            setError(null);
                          }}
                          className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-primary-soft text-primary-deep'
                              : 'text-text hover:bg-surface-muted'
                          }`}
                        >
                          <span className="font-bold">{label}</span>
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
                      );
                    })}
                  </div>
                )}
              </div>
            </FormField>
            {routeError ? (
              <div className="mt-1 flex items-center justify-between gap-2">
                <p role="alert" className="text-xs text-danger">
                  Could not load your approver.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRouteRetry((value) => value + 1)}
                >
                  Retry approver
                </Button>
              </div>
            ) : null}
          </div>

          <div>
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

            {/* Enhanced Modern Leave Type Dropdown (No Icons) */}
            <FormField
              label="Leave Type"
              htmlFor="apply-leave-type-input"
              required
              helperText={
                selectedBalance
                  ? `${selectedBalance.remaining} days available out of ${selectedBalance.allotted + selectedBalance.carriedForward} total days.`
                  : selectedPolicy?.hasBalance
                    ? `${selectedPolicy.annualDays} days quota.`
                    : isPermission
                      ? 'Permission request (up to 2 hours).'
                      : undefined
              }
            >
              <div ref={dropdownRef} className="relative w-full" data-testid="leave-type-combobox">
                {/* Input Trigger Box */}
                <div
                  onClick={() => {
                    setIsDropdownOpen(true);
                    inputRef.current?.focus();
                  }}
                  className={`w-full rounded-input border bg-surface px-3 py-2 text-sm flex items-center justify-between cursor-pointer shadow-xs transition-all h-11 min-h-[44px] ${
                    isDropdownOpen
                      ? 'border-primary-strong ring-1 ring-primary-strong'
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                    <input
                      ref={inputRef}
                      id="apply-leave-type-input"
                      data-testid="apply-leave-type-search-input"
                      type="text"
                      value={
                        isDropdownOpen ? searchQuery : selectedPolicy ? selectedPolicy.name : ''
                      }
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        if (!isDropdownOpen) setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        selectedPolicy ? selectedPolicy.name : 'Search or select leave type...'
                      }
                      className="w-full bg-transparent border-none p-0 text-sm font-medium text-text placeholder-text-muted/60 focus:outline-none focus:ring-0 truncate"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Action Buttons: Clear + Dropdown toggle arrow */}
                  <div className="flex items-center gap-1 shrink-0 text-text-muted">
                    {selectedPolicy && !isDropdownOpen && (
                      <span className="hidden sm:inline-block text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-muted text-text-muted border border-border">
                        {selectedPolicy.code}
                      </span>
                    )}

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
                          isDropdownOpen ? 'rotate-180 text-primary-strong' : ''
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

                {/* Floating Modern Card Menu (No Icons) */}
                {isDropdownOpen && (
                  <div
                    className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-border bg-surface p-1.5 shadow-2xl max-h-56 overflow-y-auto space-y-1 animate-in fade-in zoom-in-95 duration-150"
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
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold block truncate">{policy.name}</span>
                              <span className="text-[10px] text-text-muted font-mono">
                                [{policy.code}]
                              </span>
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
            </FormField>
          </div>
        </div>

        {/* Row 2: Date Pickers with matching design */}
        <div
          className={`grid grid-cols-1 ${isPermission || halfDay ? 'sm:grid-cols-1' : 'sm:grid-cols-2'} gap-4`}
        >
          <FormField
            label={isPermission ? 'Permission Date' : halfDay ? 'Date' : 'Start Date'}
            htmlFor="apply-start-date"
            required
          >
            <input
              id="apply-start-date"
              data-testid="apply-start-date-input"
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-input border border-border hover:border-border-strong bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px] transition-colors"
              required
            />
          </FormField>

          {!halfDay && !isPermission && (
            <FormField label="End Date" htmlFor="apply-end-date" required>
              <input
                id="apply-end-date"
                data-testid="apply-end-date-input"
                type="date"
                min={startDate}
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                disabled={isSubmitting}
                className="w-full rounded-input border border-border hover:border-border-strong bg-surface px-3 py-2 text-sm text-text focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong h-11 min-h-[44px] transition-colors"
                required
              />
            </FormField>
          )}
        </div>

        {/* Row 3: Half-Day Option & Duration strip */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-3.5 py-2.5 rounded-input bg-surface border border-border text-xs">
          {selectedPolicy?.allowHalfDay && !isPermission ? (
            <label
              htmlFor="apply-half-day-toggle"
              className="flex items-center gap-2.5 cursor-pointer select-none text-xs font-semibold text-text"
            >
              <input
                id="apply-half-day-toggle"
                data-testid="apply-half-day-toggle"
                type="checkbox"
                checked={halfDay}
                disabled={isSubmitting}
                onChange={(e) => handleHalfDayToggle(e.target.checked)}
                className="h-4 w-4 rounded-md border-border-strong text-primary-deep focus:ring-primary-strong accent-primary-deep cursor-pointer"
              />
              <span>
                Half-Day Leave (0.5 day)
                <span className="font-normal text-text-subtle ml-1.5 hidden sm:inline">
                  (single working day)
                </span>
              </span>
            </label>
          ) : (
            <div className="flex items-center gap-2 text-xs text-text-subtle font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-strong/70 shrink-0" />
              <span>{isPermission ? 'Short permission' : 'Standard working day request'}</span>
            </div>
          )}

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-text-subtle font-medium">
              {isPermission ? 'Permission:' : 'Calculated Duration:'}
            </span>
            <span
              className="text-xs font-bold text-primary-deep font-mono px-2.5 py-1 rounded-input bg-primary-soft border border-primary-strong/20"
              data-testid="estimated-days-badge"
            >
              {isPermission
                ? 'Permission (Up to 2 hrs)'
                : `${estimatedDays} ${estimatedDays === 1 ? 'day' : 'days'}`}
            </span>
          </div>
        </div>

        {/* Row 4: Reason and Supporting Document in a responsive 2-column grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
          {/* Left Column: Reason / Notes */}
          <FormField
            label="Reason / Notes (Optional)"
            htmlFor="apply-reason"
            helperText={`${reason.length}/500 characters`}
          >
            <textarea
              id="apply-reason"
              data-testid="apply-reason-input"
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isSubmitting}
              placeholder="Provide context for your team lead and approvers..."
              className="w-full rounded-input border border-border bg-surface p-2.5 text-sm text-text placeholder:text-xs placeholder:text-text-subtle/70 focus:border-primary-strong focus:outline-none focus:ring-1 focus:ring-primary-strong resize-none transition-colors"
            />
          </FormField>

          {/* Right Column: Supporting Document Upload */}
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="leave-document-upload"
                className="text-xs font-semibold text-text flex items-center gap-1.5"
              >
                <span>Attach Document</span>
                <span className="text-[11px] font-normal text-text-subtle">(Optional)</span>
              </label>
              {attachment && (
                <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Attached
                </span>
              )}
            </div>

            <input
              ref={fileInputRef}
              id="leave-document-upload"
              data-testid="leave-document-upload"
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              disabled={isSubmitting}
            />

            {!attachment ? (
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
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFile(file);
                }}
                className={`relative flex flex-col items-center justify-center p-3 rounded-input border-2 border-dashed cursor-pointer transition-all min-h-[92px] text-center ${
                  isDragging
                    ? 'border-primary-strong bg-primary-soft/60 ring-2 ring-primary-soft'
                    : 'border-border hover:border-primary-strong/60 hover:bg-surface-muted/60 bg-surface'
                }`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                aria-label="Upload supporting document or certificate"
              >
                <div className="flex items-center gap-2 text-text-muted mb-1">
                  <svg
                    className="w-4 h-4 text-primary-strong"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span className="text-xs font-semibold text-text">
                    Drop file here or <span className="text-primary-deep underline">browse</span>
                  </span>
                </div>
                <p className="text-[11px] text-text-subtle">PDF, PNG, JPG, DOCX (Max 5 MB)</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 rounded-input border border-border bg-surface-muted min-h-[92px]">
                <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                  <div className="w-9 h-9 rounded-xl bg-primary-soft text-primary-deep flex items-center justify-center shrink-0 border border-primary-strong/20 font-bold text-xs font-mono uppercase">
                    {attachment.name.split('.').pop() || 'DOC'}
                  </div>
                  <div className="min-w-0 truncate">
                    <p className="text-xs font-semibold text-text truncate font-medium">
                      {attachment.name}
                    </p>
                    <p className="text-[11px] text-text-subtle mt-0.5">
                      {(attachment.size / 1024).toFixed(1)} KB • Ready to submit
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachment(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-rose-50 transition-colors shrink-0"
                  aria-label="Remove uploaded document"
                  title="Remove document"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            )}

            {fileError && (
              <p className="mt-1 text-xs text-danger" role="alert">
                {fileError}
              </p>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};
