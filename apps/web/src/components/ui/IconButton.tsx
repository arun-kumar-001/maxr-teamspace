import React from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  icon: React.ReactNode;
  /** Unread count shown in a small badge (hidden when 0 or undefined). */
  count?: number;
  /** Small status dot without a number. */
  dot?: boolean;
}

/** Square-rounded white button for the top bar (theme, notifications, collapse). */
export function IconButton({
  icon,
  count,
  dot = false,
  className = '',
  ...props
}: IconButtonProps) {
  const countLabel = count && count > 0 ? (count > 99 ? '99+' : String(count)) : null;
  return (
    <button
      type="button"
      className={`relative inline-flex items-center justify-center w-11 h-11 rounded-input bg-surface-raised border border-border-strong text-text hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong ${className}`}
      {...props}
    >
      <span aria-hidden="true">{icon}</span>
      {countLabel && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-danger text-white text-[11px] font-semibold leading-5 text-center tabular-nums">
          {countLabel}
          <span className="sr-only"> unread</span>
        </span>
      )}
      {!countLabel && dot && (
        <span
          className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary ring-2 ring-surface-raised"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
