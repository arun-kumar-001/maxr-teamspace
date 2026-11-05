import { useEffect, useRef, useState } from 'react';
import { useInRouterContext, useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { formatRelativeTime, getNotificationTypeStyle } from './notificationHelpers';

export interface NotificationBellProps {
  onNavigate?: (path: string) => void;
  onNavigateToInbox?: () => void;
  pollIntervalMs?: number;
}

interface NotificationBellContentProps extends NotificationBellProps {
  navigate: (path: string) => void;
}

function NotificationBellContent({
  navigate,
  onNavigateToInbox,
  pollIntervalMs = 0,
}: NotificationBellContentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount, isLoading, refresh, markAsRead, markAllAsRead } =
    useNotifications({
      page: 1,
      pageSize: 10,
      unread: unreadOnly ? true : undefined,
      pollIntervalMs,
    });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!isOpen) {
      refresh();
    }
    setIsOpen((prev) => !prev);
  };

  const handleNotificationClick = async (
    id: string,
    readAt: string | null,
    link: string | null,
  ) => {
    if (!readAt) {
      try {
        await markAsRead(id);
      } catch {
        // Continue navigation even if marking read fails
      }
    }
    setIsOpen(false);
    if (link) {
      navigate(link);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    if (onNavigateToInbox) {
      onNavigateToInbox();
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications (no unread)'
        }
        className="relative inline-flex items-center justify-center rounded-full border border-border bg-surface text-text-muted hover:bg-surface-raised hover:text-text focus:outline-none focus:ring-2 focus:ring-primary h-10 w-10 min-h-[40px] min-w-[40px] transition-colors shadow-sm"
        data-testid="notification-bell-button"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {/* Live Unread Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-deep px-1 text-[10px] font-bold text-surface shadow-sm ring-2 ring-surface"
            data-testid="notification-badge-count"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu / Popover */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications panel"
          className="absolute right-0 mt-2 z-50 w-[340px] sm:w-[400px] rounded-card border border-border bg-surface-raised shadow-raised overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          data-testid="notifications-dropdown-menu"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-surface">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-text">Notifications</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary-soft text-primary-deep text-xs font-semibold px-2 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllAsRead()}
                  className="text-xs font-medium text-primary-deep hover:text-primary-strong focus:outline-none focus:underline min-h-[32px] px-2 py-1"
                  data-testid="mark-all-read-btn"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-1 border-b border-border bg-surface-muted/50 px-3 py-1.5 text-xs">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`rounded-control px-2.5 py-1 font-medium transition-colors ${
                !unreadOnly ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              data-testid="filter-all-btn"
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`rounded-control px-2.5 py-1 font-medium transition-colors ${
                unreadOnly ? 'bg-surface text-text shadow-sm' : 'text-text-muted hover:text-text'
              }`}
              data-testid="filter-unread-btn"
            >
              Unread only ({unreadCount})
            </button>
          </div>

          {/* Notification List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border">
            {isLoading && notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">
                <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
                <p>Loading notifications...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center" data-testid="notifications-empty-state">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-text-muted mb-2">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                </div>
                <p className="text-xs font-semibold text-text">
                  {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
                </p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  {unreadOnly ? "You're all caught up!" : 'Important alerts will appear here.'}
                </p>
              </div>
            ) : (
              notifications.map((item) => {
                const style = getNotificationTypeStyle(item.type);
                const isUnread = !item.readAt;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleNotificationClick(item.id, item.readAt, item.link)}
                    className={`group flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                      isUnread
                        ? 'bg-primary-soft/30 hover:bg-primary-soft/50'
                        : 'hover:bg-surface-muted/60'
                    }`}
                    data-testid={`notification-item-${item.id}`}
                  >
                    {/* Icon */}
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${style.iconBgClass} ${style.iconTextClass}`}
                    >
                      {style.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold text-text truncate">
                          {item.title}
                        </span>
                        <span className="text-[10px] text-text-muted shrink-0">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted line-clamp-2 mt-0.5 leading-snug">
                        {item.body}
                      </p>
                    </div>

                    {/* Unread dot / Mark read icon */}
                    <div className="shrink-0 flex items-center pt-1">
                      {isUnread ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(item.id);
                          }}
                          className="h-2.5 w-2.5 rounded-full bg-primary-deep ring-2 ring-surface hover:ring-primary focus:outline-none"
                          title="Mark as read"
                          aria-label="Mark notification as read"
                        />
                      ) : (
                        <div className="h-2 w-2 rounded-full bg-transparent" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-surface px-4 py-2.5 text-center">
            <button
              type="button"
              onClick={handleViewAll}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-primary-deep hover:text-primary-strong focus:outline-none focus:underline w-full py-1 min-h-[36px]"
              data-testid="view-all-notifications-link"
            >
              <span>View all notifications</span>
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RouterNotificationBell(props: NotificationBellProps) {
  const routerNavigate = useNavigate();
  const navigate = props.onNavigate || routerNavigate;
  return <NotificationBellContent {...props} navigate={navigate} />;
}

function StaticNotificationBell(props: NotificationBellProps) {
  const navigate =
    props.onNavigate ||
    ((path: string) => {
      if (typeof window !== 'undefined') {
        window.location.href = path;
      }
    });
  return <NotificationBellContent {...props} navigate={navigate} />;
}

export function NotificationBell(props: NotificationBellProps) {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <RouterNotificationBell {...props} />;
  }
  return <StaticNotificationBell {...props} />;
}
