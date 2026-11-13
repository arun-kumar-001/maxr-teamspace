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
    'inline-flex items-center justify-center font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-strong focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50 disabled:pointer-events-none rounded-input select-none';

  // Touch targets: minimum 44px on phone (AGENTS.md §8)
  const sizeStyles: Record<ButtonSize, string> = {
    sm: 'min-h-[44px] sm:min-h-[36px] px-3.5 text-xs gap-1.5',
    md: 'min-h-[44px] px-4 text-sm gap-2',
    lg: 'min-h-[48px] px-5 text-base gap-2.5',
  };

  const variantStyles: Record<ButtonVariant, string> = {
    // Solid Mint Teal with Deep Black text and teal glow hover
    primary:
      'bg-primary-deep text-sidebar font-bold shadow-primary hover:shadow-[0_6px_24px_rgba(85,205,179,0.5)]',
    // Transparent glass
    secondary:
      'bg-white/65 backdrop-blur-md text-text border border-white/80 hover:bg-white/80 hover:shadow-[0_0_16px_rgba(85,205,179,0.25)]',
    outline:
      'bg-white/40 backdrop-blur-md text-text border border-white/70 hover:bg-white/70 hover:shadow-[0_0_16px_rgba(85,205,179,0.25)]',
    ghost: 'bg-transparent text-text-muted hover:bg-white/40 hover:text-text',
    danger: 'bg-danger text-white hover:opacity-90 active:opacity-100',
  };

  const dynamicStyle =
    variant === 'primary'
      ? {
          backgroundColor: 'rgb(85, 205, 179)',
          color: 'rgb(8, 11, 12)',
          boxShadow: '0 4px 18px rgba(85, 205, 179, 0.45)',
          ...props.style,
        }
      : variant === 'secondary' || variant === 'outline'
        ? {
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            ...props.style,
          }
        : props.style;

  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      style={dynamicStyle}
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
