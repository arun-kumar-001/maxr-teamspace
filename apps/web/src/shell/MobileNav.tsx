import { useAuth } from '../auth/AuthContext';
import { getNavItemsForRole } from './navigation';

export interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function MobileNav({ isOpen, onClose, currentPath, onNavigate }: MobileNavProps) {
  const { role, user, logout } = useAuth();
  const navItems = role ? getNavItemsForRole(role) : [];

  const handleLinkClick = (path: string) => {
    onNavigate(path);
    onClose();
  };

  return (
    <>
      {/* Slide-out Drawer for Phone (< 640px) */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          data-testid="mobile-drawer"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-navy-950 p-5 shadow-2xl flex flex-col justify-between">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-navy-800">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy-900 border border-navy-800">
                    <span className="text-sm font-black text-teal-500">M</span>
                    <span className="text-sm font-black text-brand-red">1</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">MAXR Teamspace</h3>
                    <p className="text-[10px] text-slate-400">Staff Management</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-2 text-slate-400 hover:bg-navy-900 hover:text-white focus:outline-none min-h-[44px] min-w-[44px]"
                  aria-label="Close menu"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* User badge */}
              {user && (
                <div className="my-4 p-3 rounded-lg bg-navy-900 border border-navy-800">
                  <p className="text-xs font-semibold text-white">{user.name}</p>
                  <p className="text-[11px] text-slate-400">{user.title}</p>
                </div>
              )}

              {/* Navigation Items */}
              <nav className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const isActive =
                    currentPath === item.path ||
                    (item.path !== '/dashboard' && currentPath.startsWith(item.path));
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleLinkClick(item.path)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors min-h-[44px] ${
                        isActive
                          ? 'bg-teal-500 text-white'
                          : 'text-slate-400 hover:bg-navy-900 hover:text-white'
                      }`}
                      data-testid={`mobile-drawer-item-${item.id}`}
                    >
                      <span>{item.label}</span>
                      {item.badge && (
                        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-brand-red text-white">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Logout button in drawer */}
            <div className="pt-4 border-t border-navy-800">
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-red-500 bg-navy-900 hover:bg-navy-800 min-h-[44px]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Bottom Bar for Small Mobile Phones (< 640px) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-30 flex h-16 border-t border-slate-200 bg-white sm:hidden justify-around items-center px-2 shadow-lg"
        aria-label="Bottom Quick Navigation"
        data-testid="bottom-nav"
      >
        {navItems.slice(0, 4).map((item) => {
          const isActive = currentPath === item.path;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center flex-1 py-1 min-h-[44px] min-w-[44px] text-[10px] font-medium transition-colors ${
                isActive ? 'text-teal-600 font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
              data-testid={`bottom-nav-${item.id}`}
            >
              <span className="truncate max-w-[70px]">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
