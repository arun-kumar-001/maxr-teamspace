import React from 'react';
import { Button } from './Button.js';

export interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  actionLabel,
  onAction,
  className = '',
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-surface border border-border rounded-card ${className}`}
      data-testid="empty-state"
    >
      <div className="w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-surface-muted text-text-muted">
        {icon || (
          <svg
            className="w-6 h-6 stroke-current"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
        )}
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="md">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message = 'An unexpected error occurred while loading this view.',
  onRetry,
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-surface border border-rose-200 rounded-card ${className}`}
      role="alert"
      data-testid="error-state"
    >
      <div className="w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-rose-50 text-danger">
        <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-6">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="md">
          Retry
        </Button>
      )}
    </div>
  );
}

export interface ForbiddenStateProps {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function ForbiddenState({
  title = 'Access Denied',
  message = 'You do not have permission to view or manage these records.',
  actionLabel,
  onAction,
  className = '',
}: ForbiddenStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center bg-surface border border-border rounded-card ${className}`}
      role="alert"
      data-testid="forbidden-state"
    >
      <div className="w-12 h-12 mb-4 flex items-center justify-center rounded-full bg-amber-50 text-warning">
        <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-text mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-4">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="primary" size="md">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
