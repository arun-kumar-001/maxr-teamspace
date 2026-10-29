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
    'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-input select-none';

  // Touch targets: minimum 44px on mobile touch per AGENTS.md §8
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'min-h-[36px] sm:min-h-[32px] px-3 text-xs gap-1.5',
    md: 'min-h-[44px] sm:min-h-[40px] px-4 text-sm gap-2',
    lg: 'min-h-[48px] px-6 text-base gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    primary:
      'bg-teal-500 text-white hover:bg-teal-600 focus-visible:ring-teal-500',
    secondary:
      'bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 focus-visible:ring-navy-900',
    outline:
      'border border-border bg-transparent text-text hover:bg-surface-muted focus-visible:ring-teal-500',
    ghost:
      'bg-transparent text-text hover:bg-surface-muted focus-visible:ring-teal-500',
    danger:
      'bg-danger text-white hover:opacity-90 active:opacity-100 focus-visible:ring-danger',
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
