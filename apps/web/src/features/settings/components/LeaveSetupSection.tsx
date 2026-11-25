import { useState } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Select } from '../../../components/ui/Select';
import { Input } from '../../../components/ui/Input';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import {
  type SettingsDraft,
  type CustomLeaveType,
  type PermissionPolicyConfig,
  DEFAULT_PERMISSION_POLICY,
} from '../hooks/useSettings';
import { leaveCodeFromName, validateLeaveCode } from '../lib/leave-code';

function IconClock({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 14 14" />
    </svg>
  );
}

function IconCalendar({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconPlus({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function IconEdit({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconTrash({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconMoreVertical({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="5" r="1.5" fill="currentColor" />
      <circle cx="12" cy="19" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconToggle({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      <line x1="12" y1="2" x2="12" y2="12" />
    </svg>
  );
}

interface DropdownOption {
  value: string;
  label: string;
}

/**
 * Modern Custom Dropdown:
 * Renders sleek styled selector with smooth animations, custom checkmark indicators,
 * and high-contrast readable options replacing raw native OS select popups.
 */
function ModernDropdown({
  id,
  value,
  onChange,
  options,
  disabled = false,
  direction = 'down',
  className = '',
}: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  options: DropdownOption[];
  disabled?: boolean;
  direction?: 'down' | 'up';
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const menuPlacement = direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5';

  return (
    <div className={`relative w-full ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full min-h-[44px] px-3.5 py-2.5 bg-surface border border-border-strong rounded-xl text-left flex items-center justify-between gap-2 shadow-2xs hover:border-primary-strong/70 focus:border-primary-strong focus:ring-1 focus:ring-primary-strong outline-none transition-all cursor-pointer disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed group"
      >
        <span className="font-semibold text-text text-xs sm:text-sm truncate">
          {selected?.label}
        </span>
        <svg
          className={`w-4 h-4 text-text-muted group-hover:text-primary-deep transition-transform duration-200 shrink-0 ${
            isOpen
              ? direction === 'up'
                ? ''
                : 'rotate-180 text-primary-deep'
              : direction === 'up'
                ? 'rotate-180'
                : ''
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 7.5L10 12.5L15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className={`absolute left-0 right-0 ${menuPlacement} z-40 bg-surface border border-border/90 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 max-h-52 overflow-y-auto`}
            role="listbox"
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                    isSelected
                      ? 'bg-teal-50 text-teal-900 font-bold'
                      : 'text-text hover:bg-surface-muted hover:text-primary-deep'
                  }`}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span>{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="w-4 h-4 text-primary-deep shrink-0"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      aria-hidden="true"
                    >
                      <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const PERM_COUNT_OPTIONS: DropdownOption[] = [
  { value: '1', label: '1 time' },
  { value: '2', label: '2 times' },
  { value: '3', label: '3 times' },
  { value: '4', label: '4 times' },
];

const PERM_HOURS_OPTIONS: DropdownOption[] = [
  { value: '1', label: '1 hour' },
  { value: '1.5', label: '1.5 hours' },
  { value: '2', label: '2 hours' },
  { value: '3', label: '3 hours' },
];

interface LeaveSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

export function LeaveSetupSection({ draft, onUpdate, disabled = false }: LeaveSetupSectionProps) {
  // Leave types list: strictly dynamic, starts empty if not configured
  const leaveTypes: CustomLeaveType[] = draft.customLeaveTypes ?? [];
  const permissionPolicy: PermissionPolicyConfig =
    draft.permissionPolicy ?? DEFAULT_PERMISSION_POLICY;

  // Active Three-Dot Actions Menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Helper to identify Permission leave items
  const isPermissionType = (t: { category?: string; code?: string; id?: string }) =>
    t.category === 'permission' ||
    t.code === 'PM' ||
    (t.id ? t.id.startsWith('leave_permission_') : false);

  // Modal State for Permission Policy
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false);
  const [editingPermissionId, setEditingPermissionId] = useState<string | null>(null);
  const [permName, setPermName] = useState('Short Permission');
  const [permCode, setPermCode] = useState('PM');
  const [permMonthlyCount, setPermMonthlyCount] = useState(
    String(permissionPolicy.maxPermissionsPerMonth || 2),
  );
  const [permMaxHours, setPermMaxHours] = useState(
    String(permissionPolicy.maxHoursPerPermission || 2),
  );

  const openCreatePermissionModal = () => {
    setEditingPermissionId(null);
    setPermName('');
    setPermCode('');
    setPermMonthlyCount(String(permissionPolicy.maxPermissionsPerMonth || 2));
    setPermMaxHours(String(permissionPolicy.maxHoursPerPermission || 2));
    setIsPermissionModalOpen(true);
  };

  const openEditPermissionModal = (target: CustomLeaveType) => {
    setEditingPermissionId(target.id);
    setPermName(target.name || 'Short Permission');
    setPermCode(target.code || 'PM');
    setPermMonthlyCount(String(target.quota || permissionPolicy.maxPermissionsPerMonth || 2));
    setPermMaxHours(String(permissionPolicy.maxHoursPerPermission || 2));
    setIsPermissionModalOpen(true);
  };

  const handleSavePermission = () => {
    const monthlyLimit = Math.max(1, Number(permMonthlyCount) || 2);
    const maxHours = Math.max(0.5, Number(permMaxHours) || 2);
    const finalName = permName.trim() || 'Short Permission';
    const finalCode = permCode.trim().toUpperCase() || 'PM';

    const newPolicy: PermissionPolicyConfig = {
      ...permissionPolicy,
      enabled: true,
      maxPermissionsPerMonth: monthlyLimit,
      maxHoursPerPermission: maxHours,
      approvalFlow: 'lead_only',
    };

    const targetId = editingPermissionId || `leave_permission_${Date.now()}`;

    const permissionLeaveType: CustomLeaveType = {
      id: targetId,
      name: finalName,
      code: finalCode,
      category: 'permission',
      frequency: 'monthly',
      quota: monthlyLimit,
      annualEntitlement: monthlyLimit,
      isPaid: true,
      accrualMethod: 'monthly',
      carryForwardEnabled: false,
      encashmentEnabled: false,
      isActive: true,
    };

    let updatedLeaves: CustomLeaveType[];
    if (editingPermissionId) {
      updatedLeaves = leaveTypes.map((t) =>
        t.id === editingPermissionId ? permissionLeaveType : t,
      );
    } else {
      updatedLeaves = [...leaveTypes, permissionLeaveType];
    }

    onUpdate({
      permissionPolicy: newPolicy,
      customLeaveTypes: updatedLeaves,
    });
    setIsPermissionModalOpen(false);
  };

  // Modal State for Create/Edit Leave Type
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState<CustomLeaveType['category']>('general');
  const [formIsPaid, setFormIsPaid] = useState(true);
  const [formAccrualMethod, setFormAccrualMethod] = useState<
    'monthly' | 'yearly' | 'upfront' | 'manual'
  >('yearly');
  const [formQuota, setFormQuota] = useState('12');
  const [formMonthlyCredit, setFormMonthlyCredit] = useState('1.0');
  const [formMaxBalance, setFormMaxBalance] = useState('30');
  const [formDescription, setFormDescription] = useState('');
  const [formCarryForwardEnabled, setFormCarryForwardEnabled] = useState(false);
  const [formCarryForwardMax, setFormCarryForwardMax] = useState('5');
  const [formCarryForwardExpiry, setFormCarryForwardExpiry] = useState('12');
  const [formEncashmentEnabled, setFormEncashmentEnabled] = useState(false);
  const [formMaxEncashable, setFormMaxEncashable] = useState('10');
  const [formEncashmentBasis, setFormEncashmentBasis] = useState<
    'basic_salary' | 'gross_salary' | 'fixed_rate'
  >('basic_salary');
  const [formAllowHalfDay, setFormAllowHalfDay] = useState(false);
  const [formAllowNegative, setFormAllowNegative] = useState(false);
  const [formRequireDocs, setFormRequireDocs] = useState(false);
  const [formMinDaysForDocs, setFormMinDaysForDocs] = useState('2');
  const [formNoticePeriod, setFormNoticePeriod] = useState('1');
  const [formMaxConsecutive, setFormMaxConsecutive] = useState('14');
  const [formAllowProbation, setFormAllowProbation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Reset or Open Create Modal
  const openCreateModal = () => {
    setEditingTypeId(null);
    setFormName('');
    setFormCode('');
    setFormCategory('general');
    setFormIsPaid(true);
    setFormAccrualMethod('yearly');
    setFormQuota('0');
    setFormMonthlyCredit('0');
    setFormMaxBalance('0');
    setFormDescription('');
    setFormCarryForwardEnabled(false);
    setFormCarryForwardMax('0');
    setFormCarryForwardExpiry('12');
    setFormEncashmentEnabled(false);
    setFormMaxEncashable('0');
    setFormEncashmentBasis('basic_salary');
    setFormAllowHalfDay(false);
    setFormAllowNegative(false);
    setFormRequireDocs(false);
    setFormMinDaysForDocs('2');
    setFormNoticePeriod('1');
    setFormMaxConsecutive('14');
    setFormAllowProbation(false);
    setFormError(null);
    setIsModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (t: CustomLeaveType) => {
    setEditingTypeId(t.id);
    setFormName(t.name);
    setFormCode(t.code ?? t.id.slice(0, 4).toUpperCase());
    setFormCategory(t.category ?? 'general');
    setFormIsPaid(t.isPaid);
    setFormAccrualMethod(t.accrualMethod ?? (t.frequency === 'monthly' ? 'monthly' : 'yearly'));
    setFormQuota(String(t.quota || t.annualEntitlement || 12));
    setFormMonthlyCredit(String(t.monthlyCredit ?? (t.quota / 12 || 1.0)));
    setFormMaxBalance(String(t.maxBalance ?? 30));
    setFormDescription(t.description ?? '');
    setFormCarryForwardEnabled(t.carryForwardEnabled ?? false);
    setFormCarryForwardMax(String(t.carryForwardMax ?? 0));
    setFormCarryForwardExpiry(String(t.carryForwardExpiryMonths ?? 12));
    setFormEncashmentEnabled(t.encashmentEnabled ?? false);
    setFormMaxEncashable(String(t.maxEncashableDays ?? 0));
    setFormEncashmentBasis(t.encashmentBasis ?? 'basic_salary');
    setFormAllowHalfDay(t.allowHalfDay ?? false);
    setFormAllowNegative(t.allowNegativeBalance ?? false);
    setFormRequireDocs(t.requireDocs ?? false);
    setFormMinDaysForDocs(String(t.minDaysForDocs ?? 2));
    setFormNoticePeriod(String(t.noticePeriodDays ?? 1));
    setFormMaxConsecutive(String(t.maxConsecutiveDays ?? 14));
    setFormAllowProbation(t.allowProbation ?? false);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveLeaveType = () => {
    setFormError(null);
    const cleanName = formName.trim();
    if (!cleanName) {
      setFormError('Please enter a leave type name');
      return;
    }
    const codeResult = formCode.trim() ? validateLeaveCode(formCode) : leaveCodeFromName(cleanName);
    if (!codeResult.ok) {
      setFormError(codeResult.error);
      return;
    }
    const cleanCode = codeResult.value;

    const quotaNum = formIsPaid ? Number(formQuota) || 0 : 0;

    const newTypeData: CustomLeaveType = {
      id: editingTypeId ?? `leave_${cleanCode.toLowerCase()}_${Date.now()}`,
      name: cleanName,
      code: cleanCode,
      category: formCategory,
      isPaid: formIsPaid,
      frequency: formAccrualMethod === 'monthly' ? 'monthly' : 'yearly',
      accrualMethod: formIsPaid ? formAccrualMethod : 'manual',
      quota: quotaNum,
      annualEntitlement: quotaNum,
      monthlyCredit: formIsPaid ? Number(formMonthlyCredit) || 0 : 0,
      maxBalance: formIsPaid ? Number(formMaxBalance) || 30 : 0,
      description: formDescription.trim() || undefined,
      carryForwardEnabled: formIsPaid ? formCarryForwardEnabled : false,
      carryForwardMax: formIsPaid && formCarryForwardEnabled ? Number(formCarryForwardMax) || 0 : 0,
      carryForwardExpiryMonths:
        formIsPaid && formCarryForwardEnabled ? Number(formCarryForwardExpiry) || 12 : undefined,
      encashmentEnabled: formIsPaid ? formEncashmentEnabled : false,
      maxEncashableDays: formIsPaid && formEncashmentEnabled ? Number(formMaxEncashable) || 0 : 0,
      encashmentBasis: formEncashmentBasis,
      allowHalfDay: formAllowHalfDay,
      allowNegativeBalance: formIsPaid ? formAllowNegative : false,
      requireDocs: formRequireDocs,
      minDaysForDocs: Number(formMinDaysForDocs) || 2,
      noticePeriodDays: Number(formNoticePeriod) || 0,
      maxConsecutiveDays: Number(formMaxConsecutive) || 30,
      allowProbation: formAllowProbation,
      isActive: true,
    };

    let updated: CustomLeaveType[];
    if (editingTypeId) {
      updated = leaveTypes.map((t) => (t.id === editingTypeId ? newTypeData : t));
    } else {
      // Check code uniqueness
      if (leaveTypes.some((t) => t.code === cleanCode)) {
        setFormError(`A leave type with code "${cleanCode}" already exists.`);
        return;
      }
      updated = [...leaveTypes, newTypeData];
    }

    onUpdate({ customLeaveTypes: updated });
    setIsModalOpen(false);
  };

  const handleDeleteLeaveType = (id: string) => {
    const target = leaveTypes.find((t) => t.id === id);
    const updated = leaveTypes.filter((t) => t.id !== id);
    // Remembered so saving settings deletes it on the server as well, not only from this list.
    const removedLeaveTypes = [
      ...(draft.removedLeaveTypes ?? []),
      ...(target ? [{ id: target.id, code: target.code }] : []),
    ];
    if (target && isPermissionType(target)) {
      onUpdate({
        customLeaveTypes: updated,
        removedLeaveTypes,
        permissionPolicy: { ...permissionPolicy, enabled: false },
      });
    } else {
      onUpdate({ customLeaveTypes: updated, removedLeaveTypes });
    }
  };

  const handleToggleActive = (id: string) => {
    const target = leaveTypes.find((t) => t.id === id);
    const updated = leaveTypes.map((t) =>
      t.id === id ? { ...t, isActive: t.isActive === false ? true : false } : t,
    );
    if (target && isPermissionType(target)) {
      const willBeActive = target.isActive === false;
      onUpdate({
        customLeaveTypes: updated,
        permissionPolicy: { ...permissionPolicy, enabled: willBeActive },
      });
    } else {
      onUpdate({ customLeaveTypes: updated });
    }
  };

  return (
    <div
      className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6"
      data-testid="leave-setup-section"
    >
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#46C7B8] via-[#0D9488] to-[#0F766E] text-white flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20">
            <IconCalendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-primary-deep font-display tracking-tight">
              Dynamic Leave Policy &amp; Quota Management
            </h3>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openCreatePermissionModal}
            disabled={disabled}
            className="gap-1.5 shadow-xs border-primary-strong/40 text-primary-deep hover:bg-primary-soft/50"
            data-testid="create-permission-btn"
          >
            <IconClock className="w-3.5 h-3.5 text-primary-deep" />
            <span>Create Permission</span>
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            disabled={disabled}
            className="gap-1.5 shadow-xs"
            data-testid="create-leave-type-btn"
          >
            <IconPlus className="w-3.5 h-3.5" />
            <span>Create Leave Type</span>
          </Button>
        </div>
      </div>

      {/* Leave Types Management */}
      <div className="space-y-5">
        {leaveTypes.length === 0 ? (
          /* Attractive Initial Empty State */
          <div className="p-8 sm:p-10 rounded-2xl bg-surface-muted/40 border border-dashed border-border-strong text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center shadow-xs">
              <IconCalendar className="w-7 h-7" />
            </div>
            <div className="max-w-md mx-auto space-y-1.5">
              <h4 className="text-base font-bold text-text font-display">
                No Leave Types Configured
              </h4>
              <p className="text-xs text-text-muted leading-relaxed">
                Every company configures its leave types and policies independently. Get started by
                creating your custom leave types (e.g. Casual Leave, Sick Leave, Earned Leave,
                Maternity Leave, Comp-off).
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={openCreatePermissionModal}
                disabled={disabled}
                className="gap-2 shadow-xs border-primary-strong/40 text-primary-deep hover:bg-primary-soft/50"
                data-testid="empty-create-permission-btn"
              >
                <IconClock className="w-4 h-4 text-primary-deep" />
                <span>{permissionPolicy.enabled ? 'Manage Permission' : 'Create Permission'}</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={openCreateModal}
                disabled={disabled}
                className="gap-2 shadow-xs"
              >
                <IconPlus className="w-4 h-4" />
                <span>Create Leave Type</span>
              </Button>
            </div>
          </div>
        ) : (
          /* Modern Redesigned Leave Types Table with Restored Columns */
          <div className="rounded-2xl border border-border bg-surface overflow-x-auto min-h-[220px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-surface-muted/70 border-b border-border text-text-muted font-bold text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Name</th>
                  <th className="py-3 px-3">Code</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-4">Accrual Method</th>
                  <th className="py-3 px-4">Annual Entitlement</th>
                  <th className="py-3 px-4">Carry Forward</th>
                  <th className="py-3 px-4">Encashment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leaveTypes.map((t, index) => {
                  const isActive = t.isActive !== false;
                  const isPerm = isPermissionType(t);
                  const openUpwards = index > 0 && index >= leaveTypes.length - 1;
                  return (
                    <tr
                      key={t.id}
                      className={`hover:bg-primary-soft/20 transition-colors ${
                        !isActive ? 'opacity-65 bg-surface-muted/20' : ''
                      }`}
                    >
                      {/* Name Column */}
                      <td className="py-3.5 px-4 font-semibold text-text">
                        <div>
                          <span className="font-bold text-sm text-text block">{t.name}</span>
                          {t.description && !isPerm && (
                            <span className="text-[11px] text-text-muted block font-normal line-clamp-1 mt-0.5">
                              {t.description}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Code Column */}
                      <td className="py-3.5 px-3">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-surface-muted border border-border text-text">
                          {t.code || t.name.slice(0, 3).toUpperCase()}
                        </span>
                      </td>

                      {/* Type Column */}
                      <td className="py-3.5 px-3">
                        {isPerm ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            <span>Permission</span>
                          </span>
                        ) : t.isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            <span>Paid</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                            <span>Unpaid</span>
                          </span>
                        )}
                      </td>

                      {/* Accrual Method Column */}
                      <td className="py-3.5 px-4 capitalize text-text font-medium text-xs">
                        {isPerm
                          ? 'Monthly Quota'
                          : (t.accrualMethod ??
                            (t.frequency === 'monthly' ? 'Monthly Accrual' : 'Yearly Allocation'))}
                      </td>

                      {/* Annual Entitlement Column */}
                      <td className="py-3.5 px-4 font-bold text-xs text-primary-deep">
                        {isPerm
                          ? `${t.quota} times / mo`
                          : `${t.quota} ${t.frequency === 'monthly' ? 'days / yr (1/mo)' : 'days / yr'}`}
                      </td>

                      {/* Carry Forward Column */}
                      <td className="py-3.5 px-4">
                        {isPerm ? (
                          <span className="text-[11px] text-text-subtle font-medium">No</span>
                        ) : t.carryForwardEnabled ? (
                          <span className="text-[11px] text-indigo-700 font-medium">
                            Max {t.carryForwardMax}d ({t.carryForwardExpiryMonths ?? 12}m exp)
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-subtle">Disabled</span>
                        )}
                      </td>

                      {/* Encashment Column */}
                      <td className="py-3.5 px-4">
                        {isPerm ? (
                          <span className="text-[11px] text-text-subtle font-medium">No</span>
                        ) : t.encashmentEnabled ? (
                          <span className="text-[11px] text-amber-700 font-medium">
                            Max {t.maxEncashableDays}d
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-subtle">Disabled</span>
                        )}
                      </td>

                      {/* Status Column */}
                      <td className="py-3.5 px-3">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Inactive</span>
                          </span>
                        )}
                      </td>

                      {/* Actions with Compact Smart Dropdown */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="relative inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === t.id ? null : t.id);
                            }}
                            disabled={disabled}
                            aria-label={`Actions for ${t.name}`}
                            aria-expanded={openMenuId === t.id}
                            className="p-1.5 rounded-lg border border-border/80 text-text-muted hover:text-text hover:bg-surface-muted hover:border-primary-strong/40 transition-colors cursor-pointer shadow-2xs"
                          >
                            <IconMoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === t.id && (
                            <>
                              <div
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setOpenMenuId(null)}
                                aria-hidden="true"
                              />
                              <div
                                className={`absolute right-0 z-30 w-32 bg-surface border border-border/90 rounded-xl shadow-lg p-1 animate-in fade-in zoom-in-95 text-left ${
                                  openUpwards ? 'bottom-full mb-1' : 'top-full mt-1'
                                }`}
                                role="menu"
                                aria-label={`Actions menu for ${t.name}`}
                              >
                                {/* Edit Option */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (isPerm) {
                                      openEditPermissionModal(t);
                                    } else {
                                      openEditModal(t);
                                    }
                                  }}
                                  disabled={disabled}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-teal-900 hover:bg-teal-50/80 transition-all cursor-pointer text-left"
                                  title={isPerm ? 'Edit permission' : 'Edit leave type'}
                                >
                                  <div className="w-5 h-5 rounded-md bg-teal-100/70 text-teal-700 flex items-center justify-center shrink-0">
                                    <IconEdit className="w-3 h-3" />
                                  </div>
                                  <span>Edit</span>
                                </button>

                                {/* Activate / Deactivate Option */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleToggleActive(t.id);
                                  }}
                                  disabled={disabled}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                                    isActive
                                      ? 'text-amber-900 hover:bg-amber-50/80'
                                      : 'text-emerald-900 hover:bg-emerald-50/80'
                                  }`}
                                  title={isActive ? 'Deactivate leave type' : 'Activate leave type'}
                                >
                                  <div
                                    className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                                      isActive
                                        ? 'bg-amber-100/70 text-amber-700'
                                        : 'bg-emerald-100/70 text-emerald-700'
                                    }`}
                                  >
                                    <IconToggle className="w-3 h-3" />
                                  </div>
                                  <span>{isActive ? 'Deactivate' : 'Activate'}</span>
                                </button>

                                {/* Delete Option */}
                                <div className="my-0.5 border-t border-border/60" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    handleDeleteLeaveType(t.id);
                                  }}
                                  disabled={disabled}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50/80 transition-all cursor-pointer text-left"
                                  title="Delete leave type"
                                  aria-label={`Delete ${t.name}`}
                                >
                                  <div className="w-5 h-5 rounded-md bg-rose-100/70 text-rose-600 flex items-center justify-center shrink-0">
                                    <IconTrash className="w-3 h-3" />
                                  </div>
                                  <span>Delete</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE / EDIT LEAVE TYPE MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTypeId ? 'Edit Leave Type' : 'Create Custom Leave Type'}
        subtitle="Configure entitlement, accrual cycle, carry forward, and encashment terms."
        maxWidth="5xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={handleSaveLeaveType}>
              Save Leave Type
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {formError}
            </div>
          )}

          {/* 2-Column Side-by-Side Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-start">
            {/* LEFT COLUMN: 1. Basic Info & 2. Allocation & Accrual */}
            <div className="space-y-5">
              {/* 1. Basic Details */}
              <div className="space-y-3.5">
                <h5 className="text-xs font-bold uppercase tracking-wider text-primary-deep flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-800 inline-flex items-center justify-center text-[10px] font-bold">
                    1
                  </span>
                  <span>Basic Information</span>
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="sm:col-span-2">
                    <FormField label="Leave Type Name" htmlFor="modal-leave-name">
                      <Input
                        id="modal-leave-name"
                        placeholder="Leave Name"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                      />
                    </FormField>
                  </div>

                  <div className="sm:col-span-1">
                    <FormField label="Short Code" htmlFor="modal-leave-code">
                      <Input
                        id="modal-leave-code"
                        placeholder="Code"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                      />
                    </FormField>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <FormField label="Paid or Unpaid" htmlFor="modal-leave-paid">
                    <Select
                      id="modal-leave-paid"
                      value={formIsPaid ? 'true' : 'false'}
                      onChange={(e) => setFormIsPaid(e.target.value === 'true')}
                      options={[
                        { value: 'true', label: 'Paid Leave' },
                        { value: 'false', label: 'Unpaid Leave (LOP)' },
                      ]}
                    />
                  </FormField>

                  <FormField label="Description (Optional)" htmlFor="modal-leave-desc">
                    <Input
                      id="modal-leave-desc"
                      placeholder="Brief description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              {/* 2. Allocation & Accrual Method (Shown only for Paid Leave) */}
              {formIsPaid ? (
                <div className="space-y-3.5 pt-4 border-t border-border">
                  <h5 className="text-xs font-bold uppercase tracking-wider text-primary-deep flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-800 inline-flex items-center justify-center text-[10px] font-bold">
                      2
                    </span>
                    <span>Allocation &amp; Accrual</span>
                  </h5>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FormField label="Accrual Method" htmlFor="modal-accrual-method">
                      <Select
                        id="modal-accrual-method"
                        value={formAccrualMethod}
                        onChange={(e) =>
                          setFormAccrualMethod(
                            e.target.value as 'monthly' | 'yearly' | 'upfront' | 'manual',
                          )
                        }
                        options={[
                          { value: 'monthly', label: 'Monthly Accrual' },
                          { value: 'yearly', label: 'Yearly Allocation' },
                          { value: 'upfront', label: 'Upfront Allocation' },
                          { value: 'manual', label: 'Manual Allocation' },
                        ]}
                      />
                    </FormField>

                    {formAccrualMethod === 'monthly' ? (
                      <FormField label="Monthly Credit (Days)" htmlFor="modal-monthly-credit">
                        <Input
                          id="modal-monthly-credit"
                          type="number"
                          step="0.5"
                          min="0"
                          max="10"
                          placeholder="0"
                          value={formMonthlyCredit}
                          onChange={(e) => setFormMonthlyCredit(e.target.value)}
                        />
                      </FormField>
                    ) : (
                      <FormField label="Annual Entitlement (Days)" htmlFor="modal-annual-quota">
                        <Input
                          id="modal-annual-quota"
                          type="number"
                          step="0.5"
                          min="0"
                          max="365"
                          placeholder="0"
                          value={formQuota}
                          onChange={(e) => setFormQuota(e.target.value)}
                        />
                      </FormField>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <FormField label="Maximum Balance Cap (Days)" htmlFor="modal-max-balance">
                      <Input
                        id="modal-max-balance"
                        type="number"
                        min="0"
                        max="365"
                        placeholder="0"
                        value={formMaxBalance}
                        onChange={(e) => setFormMaxBalance(e.target.value)}
                      />
                    </FormField>
                    <div className="flex flex-col justify-center pt-2 sm:pt-4 text-xs text-text-muted">
                      <span className="font-medium text-text">Balance Cap Limit</span>
                      <span className="text-[11px] leading-relaxed">
                        Maximum accumulated leave balance permitted per employee at any time.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200/80 text-xs text-teal-900 space-y-1">
                  <span className="font-bold flex items-center gap-1.5 text-teal-950">
                    <span className="w-2 h-2 rounded-full bg-teal-600" />
                    Unpaid Leave Policy
                  </span>
                  <p className="text-[11px] text-teal-800 leading-relaxed">
                    No monthly credit or balance cap is needed. When an employee takes this leave,
                    deductions are calculated directly against working days in payroll without
                    consuming paid leave quota.
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN: 3. Carry Forward, 4. Encashment (Paid only), 5. Rules & Restrictions */}
            <div className="space-y-4 lg:border-l lg:border-border lg:pl-8">
              {/* Carry Forward & Encashment shown only for Paid Leave */}
              {formIsPaid && (
                <>
                  {/* 3. Carry Forward Rules */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-primary-deep flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-800 inline-flex items-center justify-center text-[10px] font-bold">
                          3
                        </span>
                        <span>Carry Forward</span>
                      </h5>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formCarryForwardEnabled}
                          onChange={(e) => setFormCarryForwardEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-deep" />
                      </label>
                    </div>

                    {formCarryForwardEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-surface-muted/60 rounded-xl border border-border">
                        <FormField label="Max Carry Forward Days" htmlFor="modal-cf-max">
                          <Input
                            id="modal-cf-max"
                            type="number"
                            min="0"
                            max="180"
                            placeholder="0"
                            value={formCarryForwardMax}
                            onChange={(e) => setFormCarryForwardMax(e.target.value)}
                          />
                        </FormField>

                        <FormField label="Expiry Period" htmlFor="modal-cf-expiry">
                          <Select
                            id="modal-cf-expiry"
                            value={formCarryForwardExpiry}
                            onChange={(e) => setFormCarryForwardExpiry(e.target.value)}
                            options={[
                              { value: '3', label: '3 Months' },
                              { value: '6', label: '6 Months' },
                              { value: '12', label: '12 Months (Full year)' },
                              { value: '0', label: 'No Expiry (Max cap)' },
                            ]}
                          />
                        </FormField>
                      </div>
                    )}
                  </div>

                  {/* 4. Encashment Rules */}
                  <div className="space-y-3 pt-3 border-t border-border">
                    <div className="flex items-center justify-between">
                      <h5 className="text-xs font-bold uppercase tracking-wider text-primary-deep flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-800 inline-flex items-center justify-center text-[10px] font-bold">
                          4
                        </span>
                        <span>Leave Encashment</span>
                      </h5>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formEncashmentEnabled}
                          onChange={(e) => setFormEncashmentEnabled(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-border-strong peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-deep" />
                      </label>
                    </div>

                    {formEncashmentEnabled && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 bg-surface-muted/60 rounded-xl border border-border">
                        <FormField label="Max Encashable Days" htmlFor="modal-encash-max">
                          <Input
                            id="modal-encash-max"
                            type="number"
                            min="0"
                            max="60"
                            placeholder="0"
                            value={formMaxEncashable}
                            onChange={(e) => setFormMaxEncashable(e.target.value)}
                          />
                        </FormField>

                        <FormField label="Calculation Basis" htmlFor="modal-encash-basis">
                          <Select
                            id="modal-encash-basis"
                            value={formEncashmentBasis}
                            onChange={(e) =>
                              setFormEncashmentBasis(
                                e.target.value as 'basic_salary' | 'gross_salary' | 'fixed_rate',
                              )
                            }
                            options={[
                              { value: 'basic_salary', label: 'Basic Salary' },
                              { value: 'gross_salary', label: 'Gross Salary' },
                              { value: 'fixed_rate', label: 'Fixed Daily Rate' },
                            ]}
                          />
                        </FormField>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* 5. Additional Rules */}
              <div className={`space-y-3 ${formIsPaid ? 'pt-3 border-t border-border' : ''}`}>
                <h5 className="text-xs font-bold uppercase tracking-wider text-primary-deep flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-teal-50 text-teal-800 inline-flex items-center justify-center text-[10px] font-bold">
                    {formIsPaid ? '5' : '2'}
                  </span>
                  <span>Rules &amp; Restrictions</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted/40 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowHalfDay}
                      onChange={(e) => setFormAllowHalfDay(e.target.checked)}
                      className="rounded text-primary-deep"
                    />
                    <span className="font-medium text-text">Half-Day Requests</span>
                  </label>

                  {formIsPaid && (
                    <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted/40 transition-colors cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formAllowNegative}
                        onChange={(e) => setFormAllowNegative(e.target.checked)}
                        className="rounded text-primary-deep"
                      />
                      <span className="font-medium text-text">Negative Balance</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted/40 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formRequireDocs}
                      onChange={(e) => setFormRequireDocs(e.target.checked)}
                      className="rounded text-primary-deep"
                    />
                    <span className="font-medium text-text">Medical Doc (&gt;2d)</span>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-border/80 bg-surface hover:bg-surface-muted/40 transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formAllowProbation}
                      onChange={(e) => setFormAllowProbation(e.target.checked)}
                      className="rounded text-primary-deep"
                    />
                    <span className="font-medium text-text">Probation Eligible</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Permission Policy Modal */}
      {isPermissionModalOpen && (
        <Modal
          isOpen={isPermissionModalOpen}
          onClose={() => setIsPermissionModalOpen(false)}
          title={editingPermissionId ? 'Edit Permission' : 'Configure Permission'}
          maxWidth="md"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsPermissionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                onClick={handleSavePermission}
                data-testid="save-permission-modal-btn"
              >
                Save Permission
              </Button>
            </div>
          }
        >
          <div className="space-y-4 py-1 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <FormField label="Permission Name" htmlFor="perm-name" required>
                  <Input
                    id="perm-name"
                    placeholder="Permission Name"
                    value={permName}
                    onChange={(e) => setPermName(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="sm:col-span-1">
                <FormField label="Short Code" htmlFor="perm-code" required>
                  <Input
                    id="perm-code"
                    placeholder="Short Code"
                    value={permCode}
                    onChange={(e) => setPermCode(e.target.value.toUpperCase())}
                  />
                </FormField>
              </div>
            </div>

            <FormField label="How Many Times per Month?" htmlFor="perm-monthly-count" required>
              <ModernDropdown
                id="perm-monthly-count"
                value={permMonthlyCount}
                onChange={(val) => setPermMonthlyCount(val)}
                options={PERM_COUNT_OPTIONS}
              />
            </FormField>

            <FormField label="How Many Hours per Permission?" htmlFor="perm-max-hours" required>
              <ModernDropdown
                id="perm-max-hours"
                value={permMaxHours}
                onChange={(val) => setPermMaxHours(val)}
                options={PERM_HOURS_OPTIONS}
                direction="up"
              />
            </FormField>
          </div>
        </Modal>
      )}
    </div>
  );
}
