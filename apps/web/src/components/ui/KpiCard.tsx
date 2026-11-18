import React from 'react';

export type KpiColorVariant = 'teal' | 'emerald' | 'amber' | 'rose' | 'purple' | 'blue' | 'gray';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  variant?: KpiColorVariant;
  size?: 'sm' | 'md';
  layout?: 'stack' | 'horizontal';
  borderColor?: string;
  iconColor?: string;
  pillBg?: string;
  pillText?: string;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<
  KpiColorVariant,
  {
    borderColor: string;
    iconColor: string;
    pillBg: string;
    pillText: string;
  }
> = {
  teal: {
    borderColor: 'border-teal-300',
    iconColor: 'text-teal-600',
    pillBg: 'bg-teal-50',
    pillText: 'text-teal-800',
  },
  emerald: {
    borderColor: 'border-emerald-300',
    iconColor: 'text-emerald-600',
    pillBg: 'bg-emerald-50',
    pillText: 'text-emerald-800',
  },
  amber: {
    borderColor: 'border-amber-300',
    iconColor: 'text-amber-600',
    pillBg: 'bg-amber-50',
    pillText: 'text-amber-800',
  },
  rose: {
    borderColor: 'border-rose-300',
    iconColor: 'text-rose-600',
    pillBg: 'bg-rose-50',
    pillText: 'text-rose-800',
  },
  purple: {
    borderColor: 'border-purple-300',
    iconColor: 'text-purple-600',
    pillBg: 'bg-purple-50',
    pillText: 'text-purple-800',
  },
  blue: {
    borderColor: 'border-blue-300',
    iconColor: 'text-blue-600',
    pillBg: 'bg-blue-50',
    pillText: 'text-blue-800',
  },
  gray: {
    borderColor: 'border-border/80',
    iconColor: 'text-text-muted',
    pillBg: 'bg-surface-muted',
    pillText: 'text-text-muted',
  },
};

/**
 * Universal KPI summary card with themed border, icon, title, big stat, and pill badge.
 * Matches the approved design pattern: white background, themed outline, compact resize.
 */
export function KpiCard({
  label,
  value,
  icon,
  badge,
  variant = 'teal',
  size = 'md',
  layout = 'stack',
  borderColor,
  iconColor,
  pillBg,
  pillText,
  isActive = false,
  onClick,
  className = '',
  style,
}: KpiCardProps) {
  const styles = VARIANT_STYLES[variant] || VARIANT_STYLES.teal;
  const border = borderColor || styles.borderColor;
  const iconCls = iconColor || styles.iconColor;
  const bgPill = pillBg || styles.pillBg;
  const textPill = pillText || styles.pillText;

  const isSmall = size === 'sm';
  const isHorizontal = layout === 'horizontal';

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative bg-white border ${border} shadow-xs flex items-center justify-between min-w-0 transition-all duration-200 outline-none focus:outline-none focus:ring-0 ${
        isSmall
          ? 'py-2 px-3 sm:py-2.5 sm:px-3.5 rounded-xl min-h-[50px] gap-2.5'
          : 'p-3 sm:p-3.5 rounded-xl min-h-[64px] gap-3'
      } ${
        onClick ? 'cursor-pointer hover:shadow-card hover:-translate-y-0.5' : 'hover:shadow-xs'
      } ${isActive ? 'ring-2 ring-primary-strong/40' : ''} ${className}`}
    >
      {isHorizontal ? (
        <>
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`${iconCls} flex items-center justify-center shrink-0`}>{icon}</div>
            <span
              className={`${
                isSmall ? 'text-[11px] sm:text-xs' : 'text-xs sm:text-sm'
              } font-semibold text-text-muted tracking-tight truncate`}
            >
              {label}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`font-display ${
                isSmall ? 'text-sm sm:text-base font-bold' : 'text-lg sm:text-xl font-bold'
              } text-text tracking-tight tabular-nums`}
            >
              {value}
            </span>
            {badge && (
              <span
                className={`text-[10px] sm:text-[10.5px] font-semibold ${bgPill} ${textPill} px-2 py-0.5 rounded-full block whitespace-nowrap`}
              >
                {badge}
              </span>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className={`${iconCls} flex items-center justify-center shrink-0`}>{icon}</div>
            <div className="min-w-0 flex-1">
              <span
                className={`${
                  isSmall ? 'text-[10.5px] sm:text-[11px]' : 'text-[11px] sm:text-xs'
                } font-semibold text-text-muted uppercase tracking-wider block truncate`}
              >
                {label}
              </span>
              <span
                className={`font-display ${
                  isSmall
                    ? 'text-base sm:text-lg font-bold mt-0.5'
                    : 'text-xl sm:text-2xl font-bold mt-0.5'
                } text-text tracking-tight leading-tight block truncate`}
              >
                {value}
              </span>
            </div>
          </div>
          {badge && (
            <div className="shrink-0 pointer-events-none self-end sm:self-center">
              <span
                className={`${
                  isSmall ? 'text-[10px] px-1.5' : 'text-[10.5px] sm:text-[11px] px-2'
                } font-semibold ${bgPill} ${textPill} py-0.5 rounded-full block whitespace-nowrap`}
              >
                {badge}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
