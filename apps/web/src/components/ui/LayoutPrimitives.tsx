import React from 'react';

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  direction?: 'row' | 'col';
  gap?: '1' | '2' | '3' | '4' | '6' | '8';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between';
  wrap?: boolean;
}

export function Stack({
  children,
  direction = 'col',
  gap = '4',
  align = 'stretch',
  justify = 'start',
  wrap = false,
  className = '',
  ...props
}: StackProps) {
  const directionClasses = {
    row: 'flex-row',
    col: 'flex-col',
  };

  const gapClasses = {
    '1': 'gap-1',
    '2': 'gap-2',
    '3': 'gap-3',
    '4': 'gap-4',
    '6': 'gap-6',
    '8': 'gap-8',
  };

  const alignClasses = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
  };

  const justifyClasses = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
  };

  return (
    <div
      className={`flex ${directionClasses[direction]} ${gapClasses[gap]} ${alignClasses[align]} ${justifyClasses[justify]} ${wrap ? 'flex-wrap' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export interface GridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: '1' | '2' | '3' | '4' | 'responsive-cards' | 'responsive-dashboard';
  gap?: '2' | '4' | '6' | '8';
}

export function Grid({
  children,
  cols = 'responsive-cards',
  gap = '6',
  className = '',
  ...props
}: GridProps) {
  const colClasses = {
    '1': 'grid-cols-1',
    '2': 'grid-cols-1 sm:grid-cols-2',
    '3': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    '4': 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    'responsive-cards': 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
    'responsive-dashboard': 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  };

  const gapClasses = {
    '2': 'gap-2',
    '4': 'gap-4',
    '6': 'gap-6',
    '8': 'gap-8',
  };

  return (
    <div className={`grid ${colClasses[cols]} ${gapClasses[gap]} w-full ${className}`} {...props}>
      {children}
    </div>
  );
}
