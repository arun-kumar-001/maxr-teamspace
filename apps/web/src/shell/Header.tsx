import { useAuth } from '../auth/AuthContext';
import { Badge } from '../components/ui';
import { ROLE_DISPLAY_NAMES } from '@maxr/shared';

export interface HeaderProps {
  onToggleMobileNav?: () => void;
  activePath?: string;
}

export function Header({ onToggleMobileNav, activePath = '/dashboard' }: HeaderProps) {
  const { user, role, logout } = useAuth();

  const getPageTitle = (path: string): string => {
    if (path.includes('users')) return 'Users & Roles Administration';
    if (path.includes('audit')) return 'Security Audit Logs';
    if (path.includes('settings')) return 'Company Configuration';
    if (path.includes('employees')) return 'Employee Directory';
    if (path.includes('lifecycle')) return 'Onboarding & Offboarding Lifecycle';
    if (path.includes('policies')) return 'Leave & Attendance Policies';
    if (path.includes('attendance')) return 'Attendance Management';
    if (path.includes('approvals')) return 'Pending Approvals';
    if (path.includes('reports')) return 'Workforce Reports';
    if (path.includes('leave')) return 'My Leave & Balances';
    if (path.includes('tasks')) return 'Tasks & Projects';
    if (path.includes('profile')) return 'My Employee Profile';
    if (path.includes('payslips')) return 'Payslip Statements';
    if (path.includes('components')) return 'Shared UI Component Gallery';
    return 'Workforce Overview';
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border bg-bg/90 backdrop-blur px-4 sm:px-6 lg:px-8">
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

        <div>
          <h2 className="text-base font-semibold text-text sm:text-lg">
            {getPageTitle(activePath)}
          </h2>
          <p className="hidden text-xs text-text-muted sm:block">
            Internal workforce platform &middot; MAXR ONE
          </p>
        </div>
      </div>

      {/* Right: Role indicator & User Profile */}
      <div className="flex items-center gap-3">
        {role && (
          <div className="hidden sm:flex items-center">
            <Badge variant="primary" className="uppercase tracking-wider text-[11px]">
              {ROLE_DISPLAY_NAMES[role] || role}
            </Badge>
          </div>
        )}

        {/* User initials & details */}
        {user && (
          <div className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-border">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full bg-tile-peach text-sidebar text-xs font-semibold shadow-sm"
              title={`${user.name} (${user.email})`}
            >
              {user.avatarInitials}
            </div>

            <div className="hidden text-left md:block">
              <p className="text-xs font-semibold text-text leading-tight">{user.name}</p>
              <p className="text-[11px] text-text-muted leading-tight">{user.title}</p>
            </div>
          </div>
        )}

        {/* Logout button */}
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center rounded-input border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-surface-raised hover:text-danger hover:border-danger focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
          data-testid="logout-button"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
