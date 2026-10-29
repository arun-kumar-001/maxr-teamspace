import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  ref?: React.Ref<HTMLButtonElement>;
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ref,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-full select-none';

  // Touch targets: minimum 44px on mobile touch per AGENTS.md §8
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'min-h-[44px] sm:min-h-[36px] px-3.5 text-xs gap-1.5',
    md: 'min-h-[44px] sm:min-h-[40px] px-4 text-sm gap-2',
    lg: 'min-h-[48px] px-6 text-base gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary: 'bg-primary-deep text-white hover:bg-primary-deeper focus-visible:ring-primary-strong',
    // White pill with a soft shadow, as "New Broadcast" in the MaxR Flow header.
    secondary:
      'bg-surface text-text font-semibold border border-border-strong shadow-raised hover:bg-surface-muted focus-visible:ring-primary-strong',
    outline:
      'border border-border-strong bg-transparent text-text hover:bg-surface-muted focus-visible:ring-primary-strong',
    ghost:
      'bg-transparent text-text hover:bg-primary-soft hover:text-primary-ink focus-visible:ring-primary-strong',
    danger: 'bg-danger text-white hover:opacity-90 active:opacity-100 focus-visible:ring-danger',
  };

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <span
          className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
          role="status"
          aria-label="Loading"
        />
      )}
      {!isLoading && leftIcon && <span className="icon-left">{leftIcon}</span>}
      <span>{children}</span>
      {!isLoading && rightIcon && <span className="icon-right">{rightIcon}</span>}
    </button>
  );
}
