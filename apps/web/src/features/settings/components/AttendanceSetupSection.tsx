import { useState, useEffect } from 'react';
import { FormField } from '../../../components/ui/FormField';
import { Input } from '../../../components/ui/Input';
import {
  type SettingsDraft,
  type LateDeductionConfig,
  DEFAULT_LATE_DEDUCTION,
} from '../hooks/useSettings';

function IconClockAlert({ className = 'w-4 h-4' }: { className?: string }) {
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
      <path d="M12 2v2" />
    </svg>
  );
}

/**
 * Robust, accessible Toggle Switch:
 * Direct button role="switch" ensuring high contrast, clean slide animation,
 * and reliable visual states in all browsers.
 */
function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  labelOn,
  labelOff,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  labelOn: string;
  labelOff: string;
  id?: string;
}) {
  return (
    <div className="inline-flex items-center gap-2">
      <span
        className={`text-xs font-semibold select-none ${
          checked ? 'text-primary-deep' : 'text-text-muted'
        }`}
      >
        {checked ? labelOn : labelOff}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${
          checked ? 'bg-primary-deep' : 'bg-zinc-300'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

interface AttendanceSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

interface PresetOption {
  value: number;
  label: string;
}

interface CustomizableDropdownProps {
  id?: string;
  value: number;
  presets: PresetOption[];
  unit: string;
  defaultCustom: number;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * Customizable Dropdown:
 * Allows selection from standard presets (e.g. 1 day, 2 day, 3 day) OR switching to
 * Custom mode where the value is directly editable in the control itself with a unit suffix,
 * eliminating awkward empty placeholder boxes and duplicate inputs.
 */
function CustomizableDropdown({
  id,
  value,
  presets,
  unit,
  defaultCustom,
  min = 1,
  max = 180,
  onChange,
  disabled = false,
  className = '',
}: CustomizableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const matchedPreset = presets.find((p) => p.value === value);
  const [isCustom, setIsCustom] = useState(!matchedPreset);
  const [inputText, setInputText] = useState(String(value));

  useEffect(() => {
    if (presets.some((p) => p.value === value)) {
      setIsCustom(false);
    } else {
      setIsCustom(true);
    }
    setInputText(String(value));
  }, [value, presets]);

  return (
    <div className={`relative w-full ${className}`}>
      {isCustom ? (
        <div
          className={`relative w-full min-h-[44px] flex items-center bg-surface border border-border-strong rounded-xl shadow-2xs hover:border-primary-strong/70 focus-within:border-primary-strong focus-within:ring-1 focus-within:ring-primary-strong transition-all ${
            disabled ? 'bg-surface-muted text-text-muted cursor-not-allowed opacity-60' : ''
          }`}
        >
          <input
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={disabled}
            value={inputText}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '');
              setInputText(digits);
              if (digits !== '') {
                const num = Number(digits);
                onChange(Math.min(max, Math.max(min, num)));
              }
            }}
            onBlur={() => {
              if (inputText === '' || Number(inputText) < min) {
                setInputText(String(min));
                onChange(min);
              } else if (Number(inputText) > max) {
                setInputText(String(max));
                onChange(max);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
              }
            }}
            className="w-full h-full min-h-[42px] px-3.5 py-2 font-semibold text-text text-xs sm:text-sm bg-transparent outline-none border-none"
            aria-label={`Custom ${unit}`}
          />
          <span className="text-xs font-semibold text-text-subtle pr-2 shrink-0 select-none pointer-events-none">
            {unit}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="h-full px-2.5 flex items-center justify-center text-text-muted hover:text-primary-deep transition-colors cursor-pointer border-l border-border/80 shrink-0"
            title="Choose from presets"
            aria-label="Toggle options"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-primary-deep' : ''
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
        </div>
      ) : (
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
            {matchedPreset?.label ?? `${value} ${unit}`}
          </span>
          <svg
            className={`w-4 h-4 text-text-muted group-hover:text-primary-deep transition-transform duration-200 shrink-0 ${
              isOpen ? 'rotate-180 text-primary-deep' : ''
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
      )}

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-surface border border-border/90 rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 max-h-60 overflow-y-auto"
            role="listbox"
          >
            {presets.map((preset) => {
              const isSelected = !isCustom && preset.value === value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setIsCustom(false);
                    onChange(preset.value);
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
                  <span>{preset.label}</span>
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

            <div className="my-1 border-t border-border/70" />

            <button
              type="button"
              onClick={() => {
                setIsCustom(true);
                const nextVal = matchedPreset ? defaultCustom : value;
                onChange(nextVal);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer text-left ${
                isCustom
                  ? 'bg-teal-50 text-teal-900 font-bold'
                  : 'text-text hover:bg-surface-muted hover:text-primary-deep'
              }`}
              role="option"
              aria-selected={isCustom}
            >
              <span>Custom {isCustom ? `(${value} ${unit})` : ''}</span>
              {isCustom && (
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
          </div>
        </>
      )}
    </div>
  );
}

interface AttendanceSetupSectionProps {
  draft: SettingsDraft;
  onUpdate: (updates: Partial<SettingsDraft>) => void;
  disabled?: boolean;
}

const GRACE_PRESETS: PresetOption[] = [
  { value: 0, label: 'Exact time' },
  { value: 5, label: '5 Minutes' },
  { value: 10, label: '10 Minutes' },
  { value: 15, label: '15 Minutes' },
  { value: 30, label: '30 Minutes' },
];

const FREE_LATE_PRESETS: PresetOption[] = [
  { value: 1, label: '1 day' },
  { value: 2, label: '2 day' },
  { value: 3, label: '3 day' },
];

export function AttendanceSetupSection({
  draft,
  onUpdate,
  disabled = false,
}: AttendanceSetupSectionProps) {
  const latePolicy: LateDeductionConfig = draft.lateDeductionPolicy ?? DEFAULT_LATE_DEDUCTION;

  const updateLatePolicy = (updates: Partial<LateDeductionConfig>) => {
    onUpdate({
      lateDeductionPolicy: {
        ...latePolicy,
        ...updates,
      },
    });
  };

  const allowFreeLates = (latePolicy.freeLateLimitCount ?? 2) > 0;

  return (
    <div className="space-y-6" data-testid="attendance-setup-section">
      {/* 1. LATE COMING & SALARY REDUCTION POLICY */}
      <div className="p-5 sm:p-6 bg-surface border border-border rounded-card shadow-card space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0 shadow-2xs">
              <IconClockAlert className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-text font-display">
                Late Coming &amp; Salary Deduction Policy
              </h3>
            </div>
          </div>

          <ToggleSwitch
            checked={latePolicy.enabled}
            onChange={(checked) => updateLatePolicy({ enabled: checked })}
            disabled={disabled}
            labelOn="Late Penalty Active"
            labelOff="Penalty Disabled"
          />
        </div>

        {latePolicy.enabled ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {/* Grace Period with Customizable Dropdown */}
            <div>
              <FormField label="Check-in Grace Period" htmlFor="late-grace-minutes" required>
                <CustomizableDropdown
                  id="late-grace-minutes"
                  value={latePolicy.graceMinutes ?? 15}
                  presets={GRACE_PRESETS}
                  unit="Minutes"
                  defaultCustom={20}
                  min={0}
                  max={180}
                  onChange={(val) => updateLatePolicy({ graceMinutes: val })}
                  disabled={disabled}
                />
              </FormField>
            </div>

            {/* Free Late Count with Toggle */}
            <div className="space-y-2">
              <div className="flex items-center justify-between min-h-[22px]">
                <label
                  htmlFor="free-lates-toggle"
                  className="block text-xs font-bold uppercase tracking-wider text-text-subtle"
                >
                  Free Lates Allowance
                </label>
                <ToggleSwitch
                  id="free-lates-toggle"
                  checked={allowFreeLates}
                  onChange={(checked) => {
                    if (checked) {
                      updateLatePolicy({
                        freeLateLimitCount:
                          latePolicy.freeLateLimitCount && latePolicy.freeLateLimitCount > 0
                            ? latePolicy.freeLateLimitCount
                            : 2,
                      });
                    } else {
                      updateLatePolicy({ freeLateLimitCount: 0 });
                    }
                  }}
                  disabled={disabled}
                  labelOn="On"
                  labelOff="Off"
                />
              </div>

              {allowFreeLates && (
                <div className="animate-in fade-in duration-150">
                  <CustomizableDropdown
                    id="free-lates-dropdown"
                    value={latePolicy.freeLateLimitCount ?? 2}
                    presets={FREE_LATE_PRESETS}
                    unit="Days"
                    defaultCustom={4}
                    min={1}
                    max={31}
                    onChange={(val) => updateLatePolicy({ freeLateLimitCount: val })}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>

            {/* Penalty Amount per Late (Manual Rupee Input) */}
            <div>
              <FormField
                label="Penalty Amount per Late (₹)"
                htmlFor="late-deduction-amount"
                required
              >
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-text-subtle text-sm">
                    ₹
                  </span>
                  <Input
                    id="late-deduction-amount"
                    type="number"
                    min="0"
                    step="10"
                    placeholder="100"
                    value={latePolicy.deductionAmount}
                    onChange={(e) =>
                      updateLatePolicy({
                        deductionAmount: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    disabled={disabled}
                    className="pl-8"
                    data-testid="late-deduction-amount-input"
                  />
                </div>
              </FormField>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-surface-muted border border-border text-xs text-text-muted">
            Late penalty and salary deduction rules are currently disabled. Staff check-in times
            will be logged without pay deductions.
          </div>
        )}
      </div>
    </div>
  );
}
