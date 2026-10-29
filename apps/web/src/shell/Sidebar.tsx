import { useAuth } from '../auth/AuthContext';
import { getNavItemsForRole, type NavItem } from './navigation';
import { ROLES, type Role } from '@maxr/shared';

export interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  className?: string;
}

export function Sidebar({ currentPath, onNavigate, className = '' }: SidebarProps) {
  const { role, switchRole } = useAuth();
  const navItems = role ? getNavItemsForRole(role) : [];

  const renderIcon = (name: NavItem['iconName']) => {
    switch (name) {
      case 'home':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        );
      case 'users':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        );
      case 'clock':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'calendar':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      case 'check':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'briefcase':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        );
      case 'file-text':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case 'settings':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        );
      case 'shield':
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        );
      case 'user':
      default:
        return (
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        );
    }
  };

  return (
    <aside
      className={`hidden md:flex flex-col shrink-0 bg-navy-950 border-r border-navy-800 transition-all duration-200 z-20 ${className}`}
      data-testid="app-sidebar"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center px-4 md:px-5 border-b border-navy-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 border border-navy-800">
            <span className="text-base font-black text-teal-500 tracking-tighter">M</span>
            <span className="text-base font-black text-brand-red">1</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-sm font-bold tracking-tight text-white">MAXR Teamspace</h1>
            <p className="text-[10px] text-slate-400">Staff Management</p>
          </div>
        </div>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <p className="hidden lg:block px-3 pb-2 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
          Navigation
        </p>
        <nav className="space-y-1" aria-label="Sidebar Navigation">
          {navItems.map((item) => {
            const isActive =
              currentPath === item.path ||
              (item.path !== '/dashboard' && currentPath.startsWith(item.path));
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-all group min-h-[44px] ${
                  isActive
                    ? 'bg-teal-500 text-white shadow-sm'
                    : 'text-slate-400 hover:bg-navy-900 hover:text-white'
                }`}
                title={item.label}
                data-testid={`nav-item-${item.id}`}
              >
                <span
                  className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-teal-500'}
                >
                  {renderIcon(item.iconName)}
                </span>
                <span className="hidden lg:inline-block flex-1 text-left truncate">
                  {item.label}
                </span>
                {item.badge && (
                  <span className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-red text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Dev Role Quick Switcher footer */}
      <div className="p-3 border-t border-navy-800 bg-navy-900/50">
        <div className="hidden lg:block mb-2">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
            Switch View
          </p>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.values(ROLES).map((r: Role) => (
            <button
              key={r}
              type="button"
              onClick={() => switchRole(r)}
              className={`px-2 py-1 text-[10px] font-medium rounded text-center transition-colors min-h-[32px] ${
                role === r
                  ? 'bg-teal-500 text-white font-bold'
                  : 'bg-navy-800 text-slate-400 hover:text-white hover:bg-navy-900'
              }`}
              data-testid={`sidebar-role-${r}`}
            >
              {r === ROLES.HR_MANAGER ? 'HR' : r === ROLES.TEAM_LEAD ? 'Lead' : r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
