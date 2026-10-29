import React from 'react';

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className = '',
}: FormFieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 w-full ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-xs font-semibold text-text tracking-wide uppercase select-none flex items-center gap-1"
        >
          {label}
          {required && <span className="text-danger" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="w-full">{children}</div>
      {error ? (
        <span className="text-xs text-danger" role="alert">
          {error}
        </span>
      ) : helperText ? (
        <span className="text-xs text-text-muted">{helperText}</span>
      ) : null}
    </div>
  );
}
