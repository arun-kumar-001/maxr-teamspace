import React from 'react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: SelectOption[];
  error?: string;
  helperText?: string;
  placeholder?: string;
  ref?: React.Ref<HTMLSelectElement>;
}

export function Select({
  className = '',
  options,
  error,
  helperText,
  placeholder,
  id,
  disabled,
  ref,
  ...props
}: SelectProps) {
  const errorId = error && id ? `${id}-error` : undefined;
  const helperId = helperText && id ? `${id}-helper` : undefined;

  return (
    <div className="w-full">
      <div className="relative">
        <select
          ref={ref}
          id={id}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
          className={`w-full min-h-[44px] px-3 py-2 pr-8 text-sm text-text bg-surface border rounded-input appearance-none transition-colors
            ${
              error
                ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger'
                : 'border-border focus:border-teal-500 focus:ring-1 focus:ring-teal-500'
            }
            disabled:bg-surface-muted disabled:text-text-muted disabled:cursor-not-allowed
            outline-none ${className}`}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted">
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {error && (
        <p id={errorId} className="mt-1 text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="mt-1 text-xs text-text-muted">
          {helperText}
        </p>
      )}
    </div>
  );
}
