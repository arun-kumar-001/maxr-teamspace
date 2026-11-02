import React, { useEffect, useRef } from 'react';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface ToastProps {
  id?: string;
  variant?: ToastVariant;
  title: string;
  message?: string;
  onClose?: () => void;
  /** Closes the toast after this many milliseconds; omit to keep it until dismissed. */
  autoDismissMs?: number;
  className?: string;
}

export function Toast({
  variant = 'info',
  title,
  message,
  onClose,
  autoDismissMs,
  className = '',
}: ToastProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!autoDismissMs) return undefined;
    const timer = setTimeout(() => onCloseRef.current?.(), autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs]);

  const variantStyles: Record<
    ToastVariant,
    { border: string; bg: string; icon: string; iconSvg: React.ReactNode }
  > = {
    success: {
      border: 'border-emerald-200',
      bg: 'bg-emerald-50 text-emerald-800',
      icon: 'text-success',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    danger: {
      border: 'border-rose-200',
      bg: 'bg-rose-50 text-rose-800',
      icon: 'text-danger',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.586 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    warning: {
      border: 'border-amber-200',
      bg: 'bg-amber-50 text-amber-800',
      icon: 'text-warning',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    info: {
      border: 'border-blue-200',
      bg: 'bg-blue-50 text-blue-800',
      icon: 'text-info',
      iconSvg: (
        <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  };

  const style = variantStyles[variant];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-3 p-4 bg-surface border rounded-card shadow-md transition-all max-w-md w-full ${style.border} ${className}`}
    >
      <div className={`shrink-0 mt-0.5 ${style.icon}`}>{style.iconSvg}</div>
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-text">{title}</h4>
        {message && <p className="text-xs text-text-muted mt-0.5">{message}</p>}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="shrink-0 p-1 rounded-input text-text-muted hover:bg-surface-muted hover:text-text min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
