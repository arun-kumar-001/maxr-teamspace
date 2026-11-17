import React from 'react';

export type KpiColorVariant =
  | 'teal'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'purple'
  | 'blue'
  | 'gray';

export interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  variant?: KpiColorVariant;
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
 * Matches the approved design pattern from the Leave Requests KPI cards.
 */
export function KpiCard({
  label,
  value,
  icon,
  badge,
  variant = 'teal',
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

  return (
    <div
      onClick={onClick}
      style={style}
      className={`relative p-4 sm:p-4.5 bg-white border ${border} rounded-card shadow-card flex items-center gap-3 min-w-0 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : 'hover:shadow-card'
      } ${isActive ? 'ring-2 ring-primary-strong/40' : ''} ${className}`}
    >
      <div className={`${iconCls} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 pr-16 sm:pr-20">
        <span className="text-[10.5px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider block truncate">
          {label}
        </span>
        <span className="font-display text-xl sm:text-2xl lg:text-3xl font-bold text-text tracking-tight leading-tight block">
          {value}
        </span>
      </div>
      {badge && (
        <div className="absolute bottom-2.5 right-3.5 shrink-0 pointer-events-none">
          <span
            className={`text-[10.5px] sm:text-[11px] font-semibold ${bgPill} ${textPill} px-2 py-0.5 rounded-full block whitespace-nowrap`}
          >
            {badge}
          </span>
        </div>
      )}
    </div>
  );
}
