import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar, SidebarDrawer, PageContainer } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { getSidebarGroupsForRole, getNavItemsForRole } from './navigation';
import { ROLE_DISPLAY_NAMES } from '@maxr/shared';

export interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: ReactNode;
}

export function AppShell({ currentPath, onNavigate, children }: AppShellProps) {
  const { user, role } = useAuth();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const groups = role ? getSidebarGroupsForRole(role) : [];
  const roleNavItems = role ? getNavItemsForRole(role) : [];
  // 4 primary items for mobile bottom nav (DESIGN.md §5)
  const bottomNavItems = roleNavItems.slice(0, 4);

  const brand = {
    name: 'MAXR Teamspace',
    subtitle: 'Staff Management',
    logo: (
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sidebar font-display font-bold shadow-sm">
        <span className="text-xl font-black">M</span>
        <span className="text-xl font-black text-brand-red">1</span>
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
    <div className="min-h-screen bg-bg flex overflow-x-hidden" data-testid="app-shell">
      {/* Desktop / Tablet Persistent Floating Sidebar (DESIGN.md §5) */}
      <div className="hidden md:flex p-4 shrink-0 h-screen sticky top-0" data-testid="app-sidebar">
        <Sidebar
          brand={brand}
          groups={groups}
          activeId={currentPath}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          onNavigate={(id, e) => {
            e?.preventDefault?.();
            onNavigate(id);
          }}
          user={sidebarUser}
        />
      </div>

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
        user={sidebarUser}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileNav={() => setIsMobileNavOpen(true)} activePath={currentPath} />

        <main className="flex-1 pb-20 md:pb-12">
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
