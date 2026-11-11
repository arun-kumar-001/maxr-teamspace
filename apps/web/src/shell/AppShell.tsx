import { useState, useRef, useEffect, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar, SidebarDrawer, PageContainer } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { getSidebarGroupsForRole, getNavItemsForRole } from './navigation';
import { ROLE_DISPLAY_NAMES } from '@maxr/shared';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
  initialCollapsed?: boolean;
}

export function AppShell({
  currentPath,
  onNavigate,
  children,
  initialCollapsed = false,
}: AppShellProps) {
  const { user, role, logout } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // In the browser, start in dock mode for the auto-hover dock experience
  useEffect(() => {
    setCollapsed(true);
  }, []);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const effectiveCollapsed = isPinned ? false : !isHovered && collapsed;

  const groups = role ? getSidebarGroupsForRole(role) : [];
  const roleNavItems = role ? getNavItemsForRole(role) : [];
  // 4 primary items for mobile bottom nav (DESIGN.md §5)
  const bottomNavItems = roleNavItems.slice(0, 4);

  const brand = {
    name: 'MAXR Teamspace',
    subtitle: 'Staff Management',
    logo: (
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg font-display font-bold shadow-sm"
        style={{
          background: 'rgb(85, 205, 179)',
          color: 'rgb(8, 11, 12)',
        }}
      >
        <span className="text-lg font-black">M</span>
        <span className="text-lg font-black text-brand-red">1</span>
      </div>
    ),
  };

  const sidebarUser = user
    ? {
        name: user.name,
        role: ROLE_DISPLAY_NAMES[user.role] ?? user.role,
        initials: user.avatarInitials,
      }
    : undefined;

  return (
    <div
      className="h-screen w-screen bg-bg flex overflow-hidden relative"
      style={{
        height: '100vh',
        width: '100vw',
        overflow: 'hidden',
        ['--sidebar-width' as string]: effectiveCollapsed ? '76px' : '260px',
        ['--divider-left' as string]: effectiveCollapsed ? '76px' : '260px',
        ['--content-margin' as string]: effectiveCollapsed ? '76px' : '260px',
      }}
      data-testid="app-shell"
    >
      {/* 1. LEFT SIDEBAR – FIXED (100vh, permanently fixed at top-0 left-0) */}
      <div
        className="hidden md:flex fixed top-0 left-0 h-screen z-30 transition-[width] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] flex-col"
        style={{
          width: 'var(--sidebar-width)',
          height: '100vh',
          top: 0,
          bottom: 0,
          padding: 0,
          margin: 0,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        data-testid="app-sidebar"
      >
        <Sidebar
          brand={brand}
          groups={groups}
          activeId={currentPath}
          collapsed={effectiveCollapsed}
          onCollapsedChange={(val) => {
            setIsPinned(!val);
            setCollapsed(val);
          }}
          onNavigate={(id, e) => {
            e?.preventDefault?.();
            onNavigate(id);
          }}
          onUserMenu={() => onNavigate('/profile')}
          onSignOut={logout}
          user={sidebarUser}
        />
      </div>

      {/* 2. VERTICAL DIVIDER – FIXED (Preserved structurally, invisible appearance) */}
      <div
        className="hidden md:block fixed top-0 bottom-0 h-screen z-25 pointer-events-none transition-[left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{
          left: 'var(--divider-left)',
          width: '3px',
          height: '100vh',
          top: 0,
          bottom: 0,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          opacity: 0,
        }}
        aria-hidden="true"
        data-testid="sidebar-vertical-separator"
      />

      {/* Phone Drawer (DESIGN.md §5) */}
      <SidebarDrawer
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        brand={brand}
        groups={groups}
        activeId={currentPath}
        onNavigate={(id, e) => {
          e?.preventDefault?.();
          onNavigate(id);
          setIsMobileNavOpen(false);
        }}
        onUserMenu={() => {
          onNavigate('/profile');
          setIsMobileNavOpen(false);
        }}
        onSignOut={() => {
          logout?.();
          setIsMobileNavOpen(false);
        }}
        user={sidebarUser}
      />

      {/* 3. RIGHT MAIN CONTENT – INDEPENDENT SCROLL */}
      <div
        className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto overflow-x-hidden md:[margin-left:var(--content-margin)] transition-[margin-left] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] relative z-10 no-scrollbar"
        style={{
          height: '100vh',
          top: 0,
          bottom: 0,
          paddingTop: 0,
          marginTop: 0,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          scrollbarColor: 'transparent transparent',
          borderRight: 'none',
        }}
      >
        <Header
          onToggleMobileNav={() => setIsMobileNavOpen(true)}
          activePath={currentPath}
          onNavigate={onNavigate}
        />

        <main className="flex-1 pb-10 pt-0" style={{ paddingTop: 0, marginTop: 0 }}>
          <PageContainer
            maxWidth="dashboard"
            className="pt-0 pb-6 px-3 sm:px-4 lg:px-5 md:!pl-[10px] lg:!pl-[14px]"
            style={{ paddingTop: 0, marginTop: 0 }}
          >
            {children}
          </PageContainer>
        </main>
      </div>

      {/* Phone Bottom Navigation Bar (DESIGN.md §5) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 flex items-center justify-around px-2 py-1 shadow-card"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.72)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.6)',
        }}
        aria-label="Mobile Navigation"
        data-testid="bottom-nav"
      >
        {bottomNavItems.map((item) => {
          const isActive =
            currentPath === item.path ||
            (item.path !== '/dashboard' && currentPath.startsWith(item.path));
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center p-1 min-h-[44px] min-w-[44px] rounded-input text-xs font-medium transition-colors ${
                isActive ? 'text-primary-deep font-semibold' : 'text-text-muted hover:text-text'
              }`}
              data-testid={`bottom-nav-${item.id}`}
            >
              <span
                className={`w-2 h-2 rounded-full mb-1 ${isActive ? 'bg-primary ring-2 ring-primary-soft' : 'bg-transparent'}`}
                aria-hidden="true"
              />
              <span className="text-[11px] truncate max-w-[72px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
