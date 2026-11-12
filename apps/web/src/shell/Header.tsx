import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NotificationBell } from '../features/notifications';

export interface HeaderProps {
  onToggleMobileNav?: () => void;
  activePath?: string;
  onNavigate?: (path: string) => void;
}

export function Header({ onToggleMobileNav, activePath = '/dashboard', onNavigate }: HeaderProps) {
  const { user, logout } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const getPageTitle = (path: string): string => {
    if (path.includes('users')) return 'Users & Roles Administration';
    if (path.includes('notifications')) return 'Notification Inbox';
    if (path.includes('audit')) return 'Security Audit Logs';
    if (path.includes('settings')) return 'Company Configuration';
    if (path.includes('employees')) return 'Employee Directory';
    if (path.includes('lifecycle')) return 'Onboarding & Offboarding Lifecycle';
    if (path.includes('policies')) return 'Leave & Attendance Policies';
    if (path.includes('attendance')) return 'Attendance Management';
    if (path.includes('approvals')) return 'Pending Approvals';
    if (path.includes('reports')) return 'Workforce Reports';
    if (path.includes('leave')) return 'My Leave & Balances';
    if (path.includes('projects')) return 'Projects & Initiatives';
    if (path.includes('tasks')) return 'Tasks & Projects';
    if (path.includes('profile')) return 'My Profile';
    if (path.includes('payslips')) return 'Payslip Statements';
    if (path.includes('components')) return 'Shared UI Component Gallery';
    return '';
  };

  const title = getPageTitle(activePath);

  return (
    <header className="flex h-16 w-full items-center justify-between bg-transparent px-4 sm:px-6 lg:px-8 shrink-0">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleMobileNav}
          className="inline-flex items-center justify-center rounded-input p-2 text-text-muted hover:bg-surface-raised hover:text-text focus:outline-none focus:ring-2 focus:ring-primary md:hidden min-h-[44px] min-w-[44px]"
          aria-label="Open navigation menu"
          data-testid="mobile-menu-toggle"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        {title ? (
          <div>
            <h2 className="text-base font-semibold text-text sm:text-lg">{title}</h2>
          </div>
        ) : null}
      </div>

      {/* Right: Notifications & User Profile Menu with Dropdown */}
      <div className="flex items-center gap-3">
        {user && <NotificationBell onNavigate={onNavigate} />}

        {/* User avatar dropdown trigger */}
        {user && (
          <div className="relative pl-2 sm:border-l sm:border-border" ref={userMenuRef}>
            <button
              type="button"
              id="user-menu-button"
              onClick={() => setIsUserMenuOpen((prev) => !prev)}
              aria-expanded={isUserMenuOpen}
              aria-haspopup="menu"
              aria-label={`User menu, ${user.name}`}
              className="group flex items-center gap-1.5 p-1 rounded-full hover:bg-surface-raised focus:outline-none focus:ring-2 focus:ring-primary transition-colors cursor-pointer"
              data-testid="user-menu-trigger"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-tile-peach text-sidebar text-xs font-semibold shadow-sm group-hover:scale-105 transition-transform"
                title={`${user.name} (${user.email})`}
              >
                {user.avatarInitials}
              </div>
              <svg
                viewBox="0 0 16 16"
                className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-text' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>

            {/* Dropdown Menu (revealed when avatar clicked) */}
            <div
              role="menu"
              aria-orientation="vertical"
              aria-labelledby="user-menu-button"
              className={`absolute right-0 top-full mt-2 w-56 rounded-card bg-surface border border-border shadow-raised py-2 z-50 transition-all duration-150 origin-top-right ${
                isUserMenuOpen
                  ? 'opacity-100 visible scale-100 pointer-events-auto'
                  : 'opacity-0 invisible scale-95 pointer-events-none'
              }`}
            >
              {/* User details header */}
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-bold text-text truncate">{user.name}</p>
                <p className="text-[11px] text-text-muted truncate">{user.email}</p>
              </div>

              {/* My Profile Link */}
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    onNavigate('/profile');
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-medium text-text hover:bg-surface-raised flex items-center gap-2.5 transition-colors cursor-pointer"
                  role="menuitem"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    className="w-4 h-4 text-text-muted"
                  >
                    <path d="M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm-7 9a7 7 0 1 1 14 0H3z" />
                  </svg>
                  <span>My Profile</span>
                </button>
              )}

              {/* Sign Out Action */}
              <button
                type="button"
                onClick={() => {
                  setIsUserMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2 text-xs font-medium text-danger hover:bg-negative-soft flex items-center gap-2.5 transition-colors cursor-pointer"
                role="menuitem"
                data-testid="logout-button"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  className="w-4 h-4 text-danger"
                >
                  <path d="M13 3h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-3M9 14l4-4-4-4M13 10H3" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
