import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className = '' }: TabsProps) {
  const enabled = tabs.filter((tab) => !tab.disabled);

  const handleKeyDown = (e: React.KeyboardEvent, tabId: string) => {
    const current = enabled.findIndex((tab) => tab.id === tabId);
    let next: TabItem | undefined;
    if (e.key === 'ArrowRight') next = enabled[(current + 1) % enabled.length];
    else if (e.key === 'ArrowLeft') next = enabled[(current - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;

    e.preventDefault();
    onChange(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  };

  return (
    <div className={`border-b border-border ${className}`}>
      <div
        className="-mb-px flex space-x-2 sm:space-x-4 overflow-x-auto"
        aria-label="Tabs"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, tab.id)}
              className={`
                flex items-center gap-2 py-3 px-3 sm:px-4 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors min-h-[44px]
                ${
                  isActive
                    ? 'border-teal-500 text-teal-600'
                    : 'border-transparent text-text-muted hover:text-text hover:border-slate-300'
                }
                ${tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {tab.icon && <span className="shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface TabPanelProps {
  tabId: string;
  activeTab: string;
  children: React.ReactNode;
  className?: string;
}

/** Content for one tab; only the active panel is rendered. Pairs with the ids used by `Tabs`. */
export function TabPanel({ tabId, activeTab, children, className = '' }: TabPanelProps) {
  if (tabId !== activeTab) return null;
  return (
    <div
      role="tabpanel"
      id={`panel-${tabId}`}
      aria-labelledby={`tab-${tabId}`}
      className={className}
    >
      {children}
    </div>
  );
}
