import React from 'react';

export interface PageContainerProps {
  children: React.ReactNode;
  maxWidth?: 'prose' | 'form' | 'dashboard' | 'full';
  className?: string;
  style?: React.CSSProperties;
}

export function PageContainer({
  children,
  maxWidth = 'dashboard',
  className = '',
  style,
}: PageContainerProps) {
  const maxStyles = {
    prose: 'max-w-prose',
    form: 'max-w-form',
    dashboard: 'max-w-dashboard',
    full: 'max-w-full',
  };

  return (
    <div
      className={`w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 ${maxStyles[maxWidth]} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}
