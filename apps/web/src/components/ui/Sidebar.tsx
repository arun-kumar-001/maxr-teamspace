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
  /** Icon rail / dock mode (84px). */
  collapsed: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  user?: { name: string; role: string; initials: string };
  onUserMenu?: () => void;
  onSignOut?: () => void;
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
      className={`w-4 h-4 shrink-0 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
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
      className="w-4 h-4 transition-transform duration-300"
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
 * Premium 3D Floating Glassmorphism Sidebar & Animated Dock (MAXR Teamspace).
 *
 * Supports:
 * - Fluid spring-like collapse/expand transition (84px dock <-> 288px sidebar, ~600ms).
 * - Translucent deep black frosted glass (rgba(8,11,12,0.88), blur(24px) saturate(140%)).
 * - Solid mint teal active pill (rgb(85, 205, 179)) with deep black text (rgb(8, 11, 12)).
 * - Smooth hover glow (rgba(85,205,179,0.15)) and subtle icon nudges.
 * - Submenu accordion disclosure with animated height & opacity.
 * - Bottom employee profile with floating frosted-glass dropdown menu.
 * - Fully accessible with keyboard navigation, ARIA states, and fixed rail tooltips.
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
  onSignOut,
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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  // Close profile menu on outside click
  useEffect(() => {
    if (!profileOpen) return undefined;
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [profileOpen]);

  // Hide tooltips on scroll
  useEffect(() => {
    if (!tooltip) return undefined;
    const hide = () => setTooltip(null);
    window.addEventListener('scroll', hide, true);
    return () => window.removeEventListener('scroll', hide, true);
  }, [tooltip]);

  const showTooltip = (label: string, el: HTMLElement) => {
    if (!collapsed) return;
    const rect = el.getBoundingClientRect();
    setTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 14 });
  };

  const tooltipHandlers = (label: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showTooltip(label, e.currentTarget),
    onFocus: (e: React.FocusEvent<HTMLElement>) => showTooltip(label, e.currentTarget),
    onMouseLeave: () => setTooltip(null),
    onBlur: () => setTooltip(null),
  });

  const toggleGroup = (id: string) => {
    if (collapsed) {
      // In dock mode, clicking a parent expands the full sidebar with its group open
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

  const itemBase = `group relative flex items-center w-full min-h-[38px] rounded-[12px] text-[13.5px] transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${focusRing}`;
  const itemLayout = collapsed ? 'justify-center px-0 h-10' : 'px-3 gap-2.5 py-1.5';
  const activeStyle = 'bg-primary text-sidebar font-bold shadow-sidebar-active';
  const idleStyle =
    'text-sidebar-text hover:bg-[rgba(85,205,179,0.15)] hover:text-white hover:shadow-[0_0_16px_rgba(85,205,179,0.25)]';

  const renderCount = (
    item: Pick<SidebarItem, 'count' | 'countTone' | 'label'>,
    active: boolean,
  ) => {
    if (!item.count) return null;
    const attention = item.countTone === 'attention';
    if (collapsed) {
      return (
        <span
          className={`absolute top-2 right-3 w-2 h-2 rounded-full ring-2 ring-sidebar ${
            attention ? 'bg-sidebar-attention' : 'bg-primary'
          }`}
          aria-hidden="true"
        />
      );
    }
    return (
      <span
        className={`ml-auto min-w-[20px] h-5 px-1 rounded-full text-[11px] font-semibold leading-5 text-center tabular-nums ${
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
      className={`relative flex flex-col h-full bg-sidebar text-sidebar-text rounded-[20px] transition-all duration-600 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        collapsed ? 'w-[76px]' : 'w-[256px]'
      } ${className}`}
      style={{
        height: '100vh',
        backgroundColor: 'rgba(8, 11, 12, 0.88)',
        color: 'rgb(244, 247, 246)',
        border: '1px solid rgba(244, 247, 246, 0.18)',
        backdropFilter: 'blur(24px) saturate(140%)',
        WebkitBackdropFilter: 'blur(24px) saturate(140%)',
        borderRadius: '20px',
        boxShadow:
          '0 16px 40px rgba(8, 11, 12, 0.22), inset 0 1px 1px rgba(255, 255, 255, 0.12), inset 0 -1px 1px rgba(0, 0, 0, 0.4)',
      }}
      aria-label="Main"
    >
      {/* Brand Header */}
      <div
        className={`flex shrink-0 gap-2.5 px-3 py-3 items-center transition-all duration-300 ${
          collapsed ? 'flex-col justify-center' : 'justify-between'
        }`}
      >
        <span
          className="flex items-center justify-center w-10 h-10 shrink-0 rounded-[11px] bg-primary text-sidebar shadow-sidebar-active cursor-pointer transition-transform duration-300 hover:scale-105"
          style={{
            backgroundColor: 'rgb(85, 205, 179)',
            color: 'rgb(8, 11, 12)',
            boxShadow: '0 4px 18px rgba(85, 205, 179, 0.45)',
          }}
          onClick={() => onCollapsedChange?.(!collapsed)}
          aria-hidden="true"
        >
          {brand.logo}
        </span>

        {!collapsed && (
          <span className="flex-1 min-w-0 transition-opacity duration-300">
            <span
              className="block font-display text-[15px] font-semibold leading-tight break-words"
              style={{ color: 'rgb(244, 247, 246)' }}
            >
              {brand.name}
            </span>
            {brand.subtitle && (
              <span className="block text-xs text-sidebar-muted truncate">{brand.subtitle}</span>
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
            className={`flex items-center justify-center w-8 h-8 shrink-0 rounded-[9px] border border-sidebar-border text-sidebar-text hover:bg-[rgba(85,205,179,0.15)] hover:text-white transition-all duration-200 ${focusRing}`}
          >
            <PanelIcon collapsed={collapsed} />
          </button>
        )}
      </div>

      {/* Main Navigation */}
      <nav
        id={navId}
        aria-label="Main navigation"
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5 no-scrollbar"
      >
        {groups.map((group, groupIndex) => (
          <div
            key={group.id}
            className={groupIndex > 0 ? 'mt-2 pt-2 border-t border-[rgba(244,247,246,0.1)]' : ''}
          >
            {group.label && !collapsed && (
              <p className="px-3 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-sidebar-muted transition-opacity duration-300">
                {group.label}
              </p>
            )}
            {group.label && collapsed && <span className="sr-only">{group.label}</span>}

            <ul className={`flex flex-col ${collapsed ? 'gap-1.5 items-center' : 'gap-1'}`}>
              {group.items.map((item) => {
                const hasChildren = Boolean(item.children?.length);
                const childActive = item.children?.some((c) => c.id === activeId) ?? false;
                const active = item.id === activeId || (collapsed && childActive);
                const open = !collapsed && openGroups.has(item.id);
                const subId = `${navId}-${item.id}`;

                if (hasChildren) {
                  return (
                    <li
                      key={item.id}
                      className={collapsed ? 'w-full flex justify-center' : 'w-full'}
                    >
                      <button
                        type="button"
                        onClick={() => toggleGroup(item.id)}
                        aria-expanded={collapsed ? false : open}
                        aria-controls={collapsed ? undefined : subId}
                        aria-label={collapsed ? item.label : undefined}
                        {...tooltipHandlers(item.label)}
                        style={
                          active
                            ? {
                                backgroundColor: 'rgb(85, 205, 179)',
                                color: 'rgb(8, 11, 12)',
                                boxShadow: '0 4px 20px rgba(85, 205, 179, 0.45)',
                              }
                            : undefined
                        }
                        className={`${itemBase} ${itemLayout} ${
                          active
                            ? activeStyle
                            : open
                              ? 'bg-sidebar-raised text-sidebar-strong'
                              : idleStyle
                        }`}
                      >
                        <span
                          className="shrink-0 transition-transform duration-200 group-hover:scale-105 [&>svg]:w-4 [&>svg]:h-4"
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="truncate flex-1 text-left">{item.label}</span>
                        )}
                        {renderCount(item, active)}
                        {!collapsed && (
                          <span className={item.count ? 'ml-2' : 'ml-auto'}>
                            <Chevron open={open} />
                          </span>
                        )}
                        {collapsed && srCount(item)}
                      </button>

                      {open && !collapsed && (
                        <ul
                          id={subId}
                          className="mt-1 ml-[18px] pl-3 border-l border-[rgba(244,247,246,0.15)] flex flex-col gap-0.5 transition-all duration-300"
                        >
                          {item.children?.map((child) => {
                            const childIsActive = child.id === activeId;
                            return (
                              <li key={child.id}>
                                <a
                                  href={child.href ?? '#'}
                                  aria-current={childIsActive ? 'page' : undefined}
                                  onClick={(e) => {
                                    e?.preventDefault?.();
                                    onNavigate?.(child.id, e);
                                  }}
                                  style={
                                    childIsActive
                                      ? {
                                          backgroundColor: 'rgb(85, 205, 179)',
                                          color: 'rgb(8, 11, 12)',
                                          boxShadow: '0 4px 20px rgba(85, 205, 179, 0.45)',
                                        }
                                      : undefined
                                  }
                                  className={`${itemBase} px-3 text-xs py-1.5 rounded-[10px] ${
                                    childIsActive ? activeStyle : idleStyle
                                  }`}
                                >
                                  <span className="truncate flex-1">{child.label}</span>
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
                  <li key={item.id} className={collapsed ? 'w-full flex justify-center' : 'w-full'}>
                    <a
                      href={item.href ?? '#'}
                      aria-current={item.id === activeId ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      onClick={(e) => {
                        e?.preventDefault?.();
                        onNavigate?.(item.id, e);
                      }}
                      {...tooltipHandlers(item.label)}
                      style={
                        active
                          ? {
                              backgroundColor: 'rgb(85, 205, 179)',
                              color: 'rgb(8, 11, 12)',
                              boxShadow: '0 4px 20px rgba(85, 205, 179, 0.45)',
                            }
                          : undefined
                      }
                      className={`${itemBase} ${itemLayout} ${active ? activeStyle : idleStyle}`}
                    >
                      <span
                        className="shrink-0 transition-transform duration-200 group-hover:scale-105 [&>svg]:w-4 [&>svg]:h-4"
                        aria-hidden="true"
                      >
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="truncate flex-1 text-left">{item.label}</span>
                      )}
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

      {footer && !collapsed && <div className="shrink-0 px-2.5 pb-2.5">{footer}</div>}

      {/* Bottom Profile Section with Dropdown Menu */}
      {user && (
        <div
          ref={profileMenuRef}
          className={`relative shrink-0 flex items-center gap-2.5 px-3 py-2.5 border-t border-[rgba(244,247,246,0.12)] ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          {/* Floating Profile Dropdown Card */}
          {profileOpen && (
            <div
              className={`absolute bottom-full mb-2 z-50 rounded-[14px] p-1.5 transition-all duration-300 ${
                collapsed ? 'left-full ml-2 w-48' : 'inset-x-2'
              }`}
              style={{
                backgroundColor: 'rgba(8, 11, 12, 0.95)',
                border: '1px solid rgba(244, 247, 246, 0.18)',
                backdropFilter: 'blur(24px) saturate(140%)',
                WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                boxShadow: '0 16px 40px rgba(8, 11, 12, 0.45), 0 0 20px rgba(85, 205, 179, 0.12)',
              }}
              role="menu"
              aria-label="Profile actions"
            >
              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onUserMenu?.();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-xs text-[rgb(244,247,246)] hover:bg-[rgba(85,205,179,0.15)] hover:text-white transition-colors"
                role="menuitem"
              >
                <svg
                  className="w-3.5 h-3.5 text-primary"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="font-medium">My Profile</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setProfileOpen(false);
                  onSignOut?.();
                }}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 mt-0.5 rounded-[10px] text-xs text-red-400 hover:bg-red-500/15 hover:text-red-300 transition-colors"
                role="menuitem"
              >
                <svg
                  className="w-3.5 h-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <span className="font-medium">Sign Out</span>
              </button>
            </div>
          )}

          {collapsed ? (
            <button
              type="button"
              onClick={() => setProfileOpen((prev) => !prev)}
              aria-label={`Account menu, ${user.name}`}
              {...tooltipHandlers(user.name)}
              style={{
                backgroundColor: 'rgb(85, 205, 179)',
                color: 'rgb(8, 11, 12)',
              }}
              className={`flex items-center justify-center w-9 h-9 rounded-full font-bold text-xs transition-transform duration-200 hover:scale-105 ${focusRing}`}
            >
              {user.initials}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                className="flex items-center justify-center w-9 h-9 shrink-0 rounded-full font-bold text-xs transition-transform duration-200 hover:scale-105"
                style={{
                  backgroundColor: 'rgb(85, 205, 179)',
                  color: 'rgb(8, 11, 12)',
                }}
                aria-label={`Account details, ${user.name}`}
              >
                {user.initials}
              </button>

              <div
                className="flex-1 min-w-0 cursor-pointer"
                onClick={() => setProfileOpen((prev) => !prev)}
              >
                <span
                  className="block text-[13px] font-semibold truncate"
                  style={{ color: 'rgb(244, 247, 246)' }}
                >
                  {user.name}
                </span>
                <span
                  className="block text-[11px] truncate"
                  style={{ color: 'rgba(244, 247, 246, 0.7)' }}
                >
                  {user.role}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setProfileOpen((prev) => !prev)}
                aria-label="Account menu"
                aria-expanded={profileOpen}
                className={`flex items-center justify-center w-8 h-8 rounded-[8px] text-sidebar-text hover:bg-[rgba(85,205,179,0.15)] hover:text-white transition-colors ${focusRing}`}
              >
                <svg viewBox="0 0 20 20" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                  <circle cx="10" cy="4.5" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="15.5" r="1.5" />
                </svg>
              </button>
            </>
          )}
        </div>
      )}

      {/* Dock Tooltip: fixed position so overflowing containers do not clip it */}
      {collapsed && tooltip && (
        <span
          className="fixed z-50 -translate-y-1/2 px-3 py-1.5 rounded-[10px] text-sm font-semibold pointer-events-none whitespace-nowrap transition-all duration-200 shadow-xl"
          style={{
            top: tooltip.top,
            left: tooltip.left,
            backgroundColor: 'rgba(8, 11, 12, 0.94)',
            color: 'rgb(244, 247, 246)',
            border: '1px solid rgba(244, 247, 246, 0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 24px rgba(8, 11, 12, 0.5), 0 0 12px rgba(85, 205, 179, 0.1)',
          }}
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

/** Phone navigation: floating drawer sliding in from the left with blurred backdrop overlay. */
export function SidebarDrawer({
  open,
  onClose,
  onNavigate,
  onSignOut,
  ...sidebar
}: SidebarDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocus(open, panelRef, onClose);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Navigation">
      {/* Blurred Backdrop Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Floating Navigation Drawer */}
      <div
        ref={panelRef}
        className="fixed inset-y-0 left-0 max-w-[85vw] p-3 flex flex-col z-10 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
      >
        <Sidebar
          {...sidebar}
          collapsed={false}
          onNavigate={(id, e) => {
            onNavigate?.(id, e);
            onClose();
          }}
          onSignOut={() => {
            onSignOut?.();
            onClose();
          }}
          onCollapsedChange={undefined}
          className="shadow-2xl h-full"
        />
      </div>
    </div>
  );
}
