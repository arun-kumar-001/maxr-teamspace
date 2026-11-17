import React from 'react';

export interface PrimaryActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  showIcon?: boolean;
  className?: string;
}

function DefaultPlusIcon({ className = 'w-4 h-4 shrink-0 transition-transform duration-200 group-hover:rotate-90' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * Universal primary action button used for header call-to-actions ("+ Create task", "Add Department", etc.).
 * Styled with MaxR Flow teal (`bg-primary`), high-contrast dark text (`text-sidebar`), rounded-xl,
 * and standard padding matching the main dashboard.
 */
export function PrimaryActionButton({
  children,
  icon,
  showIcon = true,
  className = '',
  type = 'button',
  ...props
}: PrimaryActionButtonProps) {
  return (
    <button
      type={type}
      className={`group inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-primary hover:bg-primary-deep text-sidebar hover:text-white font-semibold text-xs sm:text-sm shadow-xs transition-all duration-200 hover:scale-102 hover:shadow-md active:scale-95 shrink-0 cursor-pointer focus:outline-hidden ${className}`}
      {...props}
    >
      {showIcon && (icon || <DefaultPlusIcon />)}
      <span className="whitespace-nowrap font-semibold">{children}</span>
    </button>
  );
}
