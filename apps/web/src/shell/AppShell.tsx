import { useEffect, useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar, SidebarDrawer, PageContainer } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { getSidebarGroupsForRole, getNavItemsForRole } from './navigation';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function AppShell({ currentPath, onNavigate, children }: AppShellProps) {
  const { role, user } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [, setNavRevision] = useState(0);
  const [customLogo, setCustomLogo] = useState<string | null>(() => {
    try {
      return localStorage.getItem('maxr_company_logo');
    } catch {
      return null;
    }
  });


  useEffect(() => {
    const handleNavChange = () => {
      setNavRevision((r) => r + 1);
      try {
        setCustomLogo(localStorage.getItem('maxr_company_logo'));
      } catch {
        // storage unavailable
      }
    };
    window.addEventListener('storage', handleNavChange);
    window.addEventListener('maxr:staff-payslips-change', handleNavChange);
    window.addEventListener('maxr:company-config-updated', handleNavChange);
    return () => {
      window.removeEventListener('storage', handleNavChange);
      window.removeEventListener('maxr:staff-payslips-change', handleNavChange);
      window.removeEventListener('maxr:company-config-updated', handleNavChange);
    };
  }, []);

  // Ensure outer document window is locked at (0, 0) so only inner <main> scrolls
  useEffect(() => {
    const handleWindowScroll = () => {
      if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    handleWindowScroll();
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, [currentPath]);

  const groups = role ? getSidebarGroupsForRole(role) : [];
  const roleNavItems = role ? getNavItemsForRole(role) : [];
  // 4 primary items for mobile bottom nav (DESIGN.md §5)
  const bottomNavItems = roleNavItems.slice(0, 4);

  const brand = {
    name: (
      <span aria-label="MAXR Teamspace">
        Max<span className="text-primary font-bold">R</span> Teamspace
      </span>
    ),
    subtitle: 'Staff Management',
    logo: customLogo ? (
      <img
        src={customLogo}
        alt="Company Logo"
        className="w-9 h-9 rounded-lg object-contain select-none bg-white/10 p-0.5 shadow-sm"
      />
    ) : (
      <img
        src="/maxr-symbol.png"
        alt="MAXR"
        className="w-9 h-9 object-contain select-none drop-shadow-[0_1px_2px_rgba(255,255,255,0.3)]"
      />
    ),
  };

  const activeNavPath = (() => {
    if (currentPath === '/attendance/on-duty' || currentPath === '/lead/attendance') {
      return '/attendance';
    }
    if (currentPath === '/leave/requests' || currentPath === '/staff/leave') {
      return role === 'staff' ? '/staff/leave' : '/leave';
    }
    if (currentPath === '/leave') {
      return role === 'staff' ? '/staff/leave' : '/leave';
    }
    if (currentPath === '/leave/balances') {
      return role === 'staff' ? '/staff/leave' : '/leave';
    }
    if (currentPath === '/hr/leave') {
      return '/leave/policies';
    }
    if (currentPath === '/hr/holidays' || currentPath === '/leave/calendar') {
      return '/leave/holidays';
    }
    return currentPath;
  })();

  const sidebarUser = user
    ? {
        name: user.name,
        role: user.title || user.role,
        initials: user.avatarInitials,
        avatarUrl:
          user.avatarUrl ||
          (typeof window !== 'undefined' && window.localStorage
            ? localStorage.getItem(`maxr_avatar_${user.id}`) ||
              localStorage.getItem(`maxr_avatar_${user.email?.toLowerCase()}`) ||
              undefined
            : undefined),
      }
    : undefined;

  return (
    <div
      className="fixed inset-0 h-dvh w-full bg-bg flex overflow-hidden overflow-x-hidden"
      data-testid="app-shell"
    >
      {/* Desktop / Tablet Persistent Floating Sidebar (DESIGN.md §5) */}
      <div className="hidden md:flex p-4 shrink-0 h-full" data-testid="app-sidebar">
        <Sidebar
          brand={brand}
          groups={groups}
          activeId={activeNavPath}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          user={sidebarUser}
          onUserMenu={() => onNavigate('/profile')}
          onNavigate={(id, e) => {
            e?.preventDefault?.();
            onNavigate(id);
          }}
        />
      </div>

      {/* Phone Drawer (DESIGN.md §5) */}
      <SidebarDrawer
        open={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        brand={brand}
        groups={groups}
        activeId={activeNavPath}
        user={sidebarUser}
        onNavigate={(id, e) => {
          e?.preventDefault?.();
          onNavigate(id);
          setIsMobileNavOpen(false);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onToggleMobileNav={() => setIsMobileNavOpen(true)}
          activePath={currentPath}
          onNavigate={onNavigate}
        />

        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-12">
          <PageContainer maxWidth="dashboard" className="py-6 sm:py-8">
            {children}
          </PageContainer>
        </main>
      </div>

      {/* Phone Bottom Navigation Bar (DESIGN.md §5) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border flex items-center justify-around px-2 py-1 shadow-card"
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
