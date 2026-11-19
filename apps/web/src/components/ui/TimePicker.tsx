import { useState, useEffect, useRef, useId } from 'react';

export interface TimePickerProps {
  id?: string;
  name?: string;
  value?: string; // 24-hour format "HH:mm" e.g. "09:00" or "18:30"
  onChange?: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
  'data-testid'?: string;
  error?: string;
}

const HOURS_12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const MINUTES_5 = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function parse24To12(timeStr?: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  if (!timeStr || !timeStr.includes(':')) {
    return { hour12: 9, minute: 0, period: 'AM' };
  }
  const parts = timeStr.split(':');
  let h = parseInt(parts[0] || '9', 10);
  const m = parseInt(parts[1] || '0', 10);
  if (isNaN(h)) h = 9;
  const period: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
  let hour12 = h % 12;
  if (hour12 === 0) hour12 = 12;
  return { hour12, minute: isNaN(m) ? 0 : m, period };
}

function format12To24(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  let h = hour12;
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  const hh = String(h).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDisplay(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const hh = String(hour12).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${hh}:${mm} ${period}`;
}

export function TimePicker({
  id: propId,
  name,
  value = '09:00',
  onChange,
  disabled = false,
  required = false,
  className = '',
  'data-testid': testId,
  error,
}: TimePickerProps) {
  const generatedId = useId();
  const id = propId || generatedId;

  const [isOpen, setIsOpen] = useState(false);

  const { hour12: initialH, minute: initialM, period: initialP } = parse24To12(value);
  const [tempHour, setTempHour] = useState(initialH);
  const [tempMinute, setTempMinute] = useState(initialM);
  const [tempPeriod, setTempPeriod] = useState<'AM' | 'PM'>(initialP);

  const containerRef = useRef<HTMLDivElement>(null);
  const hoursColRef = useRef<HTMLDivElement>(null);
  const minutesColRef = useRef<HTMLDivElement>(null);

  // Sync state when value changes externally
  useEffect(() => {
    const parsed = parse24To12(value);
    setTempHour(parsed.hour12);
    setTempMinute(parsed.minute);
    setTempPeriod(parsed.period);
  }, [value]);

  // Scroll active items into view when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const activeHourEl = hoursColRef.current?.querySelector('[data-selected="true"]');
        const activeMinEl = minutesColRef.current?.querySelector('[data-selected="true"]');
        activeHourEl?.scrollIntoView({ block: 'nearest' });
        activeMinEl?.scrollIntoView({ block: 'nearest' });
      }, 50);
    }
  }, [isOpen]);

  // Close popup on click outside or escape
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleOpen = () => {
    if (disabled) return;
    const parsed = parse24To12(value);
    setTempHour(parsed.hour12);
    setTempMinute(parsed.minute);
    setTempPeriod(parsed.period);
    setIsOpen((prev) => !prev);
  };

  const handleApply = () => {
    const formatted = format12To24(tempHour, tempMinute, tempPeriod);
    onChange?.(formatted);
    setIsOpen(false);
  };

  const handleSetNow = () => {
    const now = new Date();
    let h = now.getHours();
    const m = Math.round(now.getMinutes() / 5) * 5;
    const p: 'AM' | 'PM' = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    setTempHour(h12);
    setTempMinute(m >= 60 ? 55 : m);
    setTempPeriod(p);
  };

  const displayTime = formatDisplay(
    parse24To12(value).hour12,
    parse24To12(value).minute,
    parse24To12(value).period,
  );

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Visual Display Input Button */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Time: ${displayTime}`}
        className={`w-full min-h-[44px] px-3.5 py-2 text-sm text-text bg-surface border rounded-input transition-all flex items-center justify-between cursor-pointer select-none text-left
          ${
            isOpen
              ? 'border-primary-strong ring-2 ring-primary/20 shadow-xs'
              : error
                ? 'border-danger focus:border-danger'
                : 'border-border-strong hover:border-primary-strong focus:border-primary-strong'
          }
          ${disabled ? 'bg-surface-muted text-text-muted cursor-not-allowed opacity-75' : ''}
          ${className}`}
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide text-text font-display text-sm">
            {displayTime}
          </span>
        </div>

        {/* Clock Icon */}
        <span
          className="text-primary-deep hover:text-primary-strong p-1 rounded-md transition-colors flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </span>
      </button>

      {/* Hidden native input for form compatibility & programmatic tests */}
      <input
        type="hidden"
        id={id}
        name={name}
        value={value}
        required={required}
        data-testid={testId}
        onChange={(e) => onChange?.(e.target.value)}
      />

      {/* Compact Popover Time Picker (3-Column Selector) */}
      {isOpen && (
        <div
          className="absolute z-50 mt-1.5 p-3 bg-surface border border-border shadow-card rounded-2xl w-[235px] left-0 sm:left-auto sm:right-0 max-w-[calc(100vw-2rem)] animate-in fade-in zoom-in-95 duration-150"
          role="dialog"
          aria-label="Clock Time Picker"
        >
          {/* Header Preview & Time Display */}
          <div className="flex items-center justify-between pb-2.5 border-b border-border/80">
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold font-display text-text">
                {String(tempHour).padStart(2, '0')}:{String(tempMinute).padStart(2, '0')}
              </span>
              <span className="text-[11px] font-bold px-1.5 py-0.5 rounded-md bg-primary-soft text-primary-deep uppercase">
                {tempPeriod}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSetNow}
              className="text-[11px] text-primary-deep hover:text-primary-strong font-semibold transition-colors"
            >
              Now
            </button>
          </div>

          {/* 3 Interactive Columns: Hour | Minute | Period */}
          <div className="grid grid-cols-3 gap-1.5 py-2.5">
            {/* Hours Column */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-subtle text-center mb-1">
                Hour
              </div>
              <div
                ref={hoursColRef}
                className="h-[124px] overflow-y-auto space-y-0.5 pr-0.5 overscroll-contain scrollbar-thin scrollbar-thumb-border"
              >
                {HOURS_12.map((h) => {
                  const isSelected = h === tempHour;
                  return (
                    <button
                      key={h}
                      type="button"
                      aria-label={`Hour ${h}`}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => setTempHour(h)}
                      className={`w-full py-1 px-1 rounded-md text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? 'bg-primary-deep text-white shadow-xs font-bold'
                          : 'text-text hover:bg-surface-muted hover:text-primary-deep'
                      }`}
                    >
                      {String(h).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes Column */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-subtle text-center mb-1">
                Min
              </div>
              <div
                ref={minutesColRef}
                className="h-[124px] overflow-y-auto space-y-0.5 pr-0.5 overscroll-contain scrollbar-thin scrollbar-thumb-border"
              >
                {MINUTES_5.map((m) => {
                  const isSelected = m === tempMinute;
                  return (
                    <button
                      key={m}
                      type="button"
                      aria-label={`Minute ${m}`}
                      data-selected={isSelected ? 'true' : undefined}
                      onClick={() => setTempMinute(m)}
                      className={`w-full py-1 px-1 rounded-md text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? 'bg-primary-deep text-white shadow-xs font-bold'
                          : 'text-text hover:bg-surface-muted hover:text-primary-deep'
                      }`}
                    >
                      {String(m).padStart(2, '0')}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* AM / PM Column */}
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-text-subtle text-center mb-1">
                Period
              </div>
              <div className="space-y-1.5 pt-0.5">
                {(['AM', 'PM'] as const).map((p) => {
                  const isSelected = tempPeriod === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTempPeriod(p)}
                      className={`w-full py-2 px-1 rounded-md text-xs font-bold text-center transition-all ${
                        isSelected
                          ? 'bg-primary-deep text-white shadow-xs'
                          : 'bg-surface-muted text-text-muted hover:text-text hover:bg-border/60'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-2.5 py-1 text-text-muted hover:text-text font-medium transition-colors rounded-md hover:bg-surface-muted text-[11px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="px-3.5 py-1 rounded-lg bg-primary-deep hover:bg-primary-deep/90 text-white font-semibold transition-colors shadow-xs text-[11px]"
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
