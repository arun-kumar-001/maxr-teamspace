import React, { useEffect, useId, useRef, useState } from 'react';
import { useDialogFocus } from './use-dialog-focus.js';

export interface SidebarItem {
  id: string;
  label: string;
  /** Outline icon, 20px; decorative. */
  icon: React.ReactNode;
  href?: string;
  /** Number shown as a badge (expanded) or a dot (rail). Hidden when 0 or undefined. */
  count?: number;
  /** `attention` = needs action (amber), `neutral` = informational. */
  countTone?: 'neutral' | 'attention';
  /** Sub-pages: the item becomes a collapsible group. */
  children?: Array<Omit<SidebarItem, 'children' | 'icon'> & { icon?: React.ReactNode }>;
}

export interface SidebarGroup {
  id: string;
  /** Shown above the group when expanded ("Workforce", "Support"). */
  label?: string;
  items: SidebarItem[];
}

export interface SidebarProps {
  brand: { name: string; subtitle?: string; logo: React.ReactNode };
  groups: SidebarGroup[];
  /** Id of the current page (a top-level item or a child). */
  activeId: string;
  /** Called on every navigation click; call `event.preventDefault()` here when a client router handles it. */
  onNavigate?: (id: string, event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Icon rail mode (88px). */
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  user?: { name: string; role: string; initials: string };
  onUserMenu?: () => void;
  /** Optional card above the user (expanded only), e.g. a monthly summary. */
  footer?: React.ReactNode;
  className?: string;
}

const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`w-4 h-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

function PanelIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="14" height="14" rx="3" />
      <path d="M8 3v14" />
      <path d={collapsed ? 'm11 8 2 2-2 2' : 'm13.5 8-2 2 2 2'} />
    </svg>
  );
}

function countText(count: number) {
  return count > 99 ? '99+' : String(count);
}

/**
 * Floating dark navigation panel (Petalo style, MaxR Flow teal). Expanded or as an icon rail;
 * the active page is a solid teal pill with a soft glow. Router-agnostic: items are links.
 */
export function Sidebar({
  brand,
  groups,
  activeId,
  onNavigate,
  collapsed,
  onCollapsedChange,
  user,
  onUserMenu,
  footer,
  className = '',
}: SidebarProps) {
  const navId = useId();
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () =>
      new Set(
        groups
          .flatMap((g) => g.items)
          .filter((i) => i.children?.some((c) => c.id === activeId))
          .map((i) => i.id),
      ),
  );
  const [tooltip, setTooltip] = useState<{ label: string; top: number; left: number } | null>(null);

  // The tooltip is placed from the icon's position, so any scroll would leave it behind: hide it.
  useEffect(() => {
    if (!tooltip) return undefined;
    const hide = () => setTooltip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tooltip]);

  const showTooltip = (label: string, el: HTMLElement) => {
    if (!collapsed) return;
    const rect = el.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 12 });
  };
  const tooltipHandlers = (label: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTooltip(label, e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTooltip(label, e.currentTarget),
    onMouseLeave: () => setTooltip(null),
    onBlur: () => setTooltip(null),
  });

  const toggleGroup = (id: string) => {
    if (collapsed) {
      // In the rail a parent opens the full sidebar with its group expanded.
      onCollapsedChange?.(false);
      setOpenGroups((prev) => new Set(prev).add(id));
      return;
    }
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const itemBase = `group relative flex items-center gap-3 w-full min-h-[44px] rounded-input text-[15px] transition-colors ${focusRing}`;
  const itemLayout = collapsed ? 'justify-center px-0 h-12' : 'px-3.5';
  const activeStyle = 'bg-primary text-sidebar font-semibold shadow-sidebar-active';
  const idleStyle = 'text-sidebar-text hover:bg-sidebar-raised hover:text-sidebar-strong';

  const renderCount = (
    item: Pick<SidebarItem, 'count' | 'countTone' | 'label'>,
    active: boolean,
  ) => {
    if (!item.count) return null;
    const attention = item.countTone === 'attention';
    if (collapsed) {
      return (
        <span
          className={`absolute top-2 right-5 w-2 h-2 rounded-full ring-2 ring-sidebar ${attention ? 'bg-sidebar-attention' : 'bg-primary'}`}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={`ml-auto min-w-[24px] h-6 px-1.5 rounded-full text-xs font-semibold leading-6 text-center tabular-nums ${
          attention
            ? 'bg-sidebar-attention text-sidebar'
            : active
              ? 'bg-sidebar text-sidebar-strong'
              : 'bg-sidebar-raised text-sidebar-strong'
        }`}
        aria-hidden="true"
      >
        {countText(item.count)}
      </span>
    );
  };

  const srCount = (item: Pick<SidebarItem, 'count'>) =>
    item.count ? <span className="sr-only">, {countText(item.count)} new</span> : null;

  return (
    <aside
      className={`relative flex flex-col h-full bg-sidebar text-sidebar-text rounded-card overflow-hidden transition-[width] duration-200 ${
        collapsed ? 'w-rail' : 'w-sidebar'
      } ${className}`}
      aria-label="Main"
    >
      {/* Brand and collapse */}
      <div
        className={`flex shrink-0 gap-3 p-4 ${collapsed ? 'flex-col items-center' : 'items-center'}`}
      >
        <span
          className="flex items-center justify-center w-12 h-12 shrink-0 rounded-[14px] bg-primary text-sidebar shadow-sidebar-active"
          aria-hidden="true"
        >
          {brand.logo}
        </span>
        {!collapsed && (
          <span className="flex-1 min-w-0">
            <span className="block font-display text-lg font-semibold leading-tight text-sidebar-strong break-words">
              {brand.name}
            </span>
            {brand.subtitle && (
              <span className="block text-sm text-sidebar-muted truncate">{brand.subtitle}</span>
            )}
          </span>
        )}
        {onCollapsedChange && (
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-controls={navId}
            aria-expanded={!collapsed}
            className={`flex items-center justify-center w-11 h-11 shrink-0 rounded-input border border-sidebar-border text-sidebar-text hover:bg-sidebar-raised hover:text-sidebar-strong ${focusRing}`}
          >
            <PanelIcon collapsed={collapsed} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav
        id={navId}
        aria-label="Main navigation"
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 pb-3"
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.id}
            className={groupIndex > 0 ? 'mt-3 pt-3 border-t border-sidebar-border' : ''}
          >
            {group.label && !collapsed && (
              <p className="px-3.5 pt-1 pb-2 text-[13px] font-medium text-sidebar-muted">
                {group.label}
              </p>
            )}
            {group.label && collapsed && <span className="sr-only">{group.label}</span>}
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children?.length);
                const childActive = item.children?.some((c) => c.id === activeId) ?? false;
                const active = item.id === activeId || (collapsed && childActive);
                const open = !collapsed && openGroups.has(item.id);
                const subId = `${navId}-${item.id}`;

                if (hasChildren) {
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        aria-expanded={collapsed ? false : open}
                        aria-controls={collapsed ? undefined : subId}
                        aria-label={collapsed ? item.label : undefined}
                        {...tooltipHandlers(item.label)}
                        className={`${itemBase} ${itemLayout} ${
                          active
                            ? activeStyle
                            : open
                              ? 'bg-sidebar-raised text-sidebar-strong'
                              : idleStyle
                        }`}
                      >
                        <span className="shrink-0" aria-hidden="true">
                          {item.icon}
                        </span>
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {renderCount(item, active)}
                        {!collapsed && (
                          <span className={item.count ? 'ml-2' : 'ml-auto'}>
                            <Chevron open={open} />
                          </span>
                        )}
                        {collapsed && srCount(item)}
                      </button>
                      {open && (
                        <ul
                          id={subId}
                          className="mt-1 ml-[22px] pl-4 border-l border-sidebar-border flex flex-col gap-1"
                        >
                          {item.children?.map((child) => {
                            const childIsActive = child.id === activeId;
                            return (
                              <li key={child.id}>
                                <a
                                  href={child.href ?? '#'}
                                  aria-current={childIsActive ? 'page' : undefined}
                                  onClick={(e) => onNavigate?.(child.id, e)}
                                  className={`${itemBase} px-3.5 text-sm ${childIsActive ? activeStyle : idleStyle}`}
                                >
                                  <span className="truncate">{child.label}</span>
                                  {renderCount(child, childIsActive)}
                                  {srCount(child)}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </li>
                  );
                }

                return (
                  <li key={item.id}>
                    <a
                      href={item.href ?? '#'}
                      aria-current={item.id === activeId ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      onClick={(e) => onNavigate?.(item.id, e)}
                      {...tooltipHandlers(item.label)}
                      className={`${itemBase} ${itemLayout} ${active ? activeStyle : idleStyle}`}
                    >
                      <span className="shrink-0" aria-hidden="true">
                        {item.icon}
                      </span>
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {renderCount(item, active)}
                      {srCount(item)}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {footer && !collapsed && <div className="shrink-0 px-3 pb-3">{footer}</div>}

      {/* User */}
      {user && (
        <div
          className={`shrink-0 flex items-center gap-3 p-4 border-t border-sidebar-border ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed ? (
            <button
              type="button"
              onClick={onUserMenu}
              aria-label={`Account menu, ${user.name}`}
              {...tooltipHandlers(user.name)}
              className={`flex items-center justify-center w-12 h-12 rounded-full bg-tile-peach text-sidebar font-semibold ${focusRing}`}
            >
              {user.initials}
            </button>
          ) : (
            <>
              <span
                className="flex items-center justify-center w-12 h-12 shrink-0 rounded-full bg-tile-peach text-sidebar font-semibold"
                aria-hidden="true"
              >
                {user.initials}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-sidebar-strong truncate">
                  {user.name}
                </span>
                <span className="block text-sm text-sidebar-muted truncate">{user.role}</span>
              </span>
              {onUserMenu && (
                <button
                  type="button"
                  onClick={onUserMenu}
                  aria-label="Account menu"
                  className={`flex items-center justify-center w-11 h-11 rounded-input text-sidebar-text hover:bg-sidebar-raised ${focusRing}`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    className="w-5 h-5"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <circle cx="10" cy="4.5" r="1.5" />
                    <circle cx="10" cy="10" r="1.5" />
                    <circle cx="10" cy="15.5" r="1.5" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Rail tooltip: fixed so the scrolling nav cannot clip it; shown on hover and keyboard focus. */}
      {collapsed && tooltip && (
        <span
          className="fixed z-50 -translate-y-1/2 px-2.5 py-1.5 rounded-lg bg-sidebar text-sidebar-strong text-sm font-medium shadow-raised pointer-events-none whitespace-nowrap"
          style={{ top: tooltip.top, left: tooltip.left }}
          aria-hidden="true"
        >
          {tooltip.label}
        </span>
      )}
    </aside>
  );
}

export interface SidebarDrawerProps extends Omit<SidebarProps, 'collapsed' | 'onCollapsedChange'> {
  open: boolean;
  onClose: () => void;
}

/** Phone navigation: the expanded sidebar slides in from the left as a modal drawer. */
export function SidebarDrawer({ open, onClose, onNavigate, ...sidebar }: SidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-y-0 left-0 p-3 max-w-[calc(100vw-48px)] flex focus:outline-none"
        style={{
          paddingTop: 'max(12px, env(safe-area-inset-top))',
          paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
        }}
      >
        <Sidebar
          {...sidebar}
          collapsed={false}
          className="max-w-full"
          onNavigate={(id, e) => {
            onNavigate?.(id, e);
            onClose();
          }}
        />
      </div>
    </div>
  );
}
