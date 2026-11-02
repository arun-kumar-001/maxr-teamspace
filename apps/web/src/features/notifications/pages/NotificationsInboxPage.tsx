import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { useAuth } from '../../../auth/AuthContext';
import { Button, PageContainer } from '../../../components/ui';
import { AnnouncementModal } from '../components/AnnouncementModal';
import { formatRelativeTime, getNotificationTypeStyle } from '../components/notificationHelpers';
import { useNotifications } from '../hooks/useNotifications';

export function NotificationsInboxPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isAnnouncementOpen, setIsAnnouncementOpen] = useState(false);

  const canAnnounce = role === ROLES.ADMIN || user?.permissions?.includes('notifications.announce');

  const {
    notifications,
    unreadCount,
    meta,
    isLoading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
    sendAnnouncement,
  } = useNotifications({
    page: currentPage,
    pageSize: 20,
    unread: unreadOnly ? true : undefined,
  });

  const handleFilterChange = (onlyUnread: boolean) => {
    setUnreadOnly(onlyUnread);
    setCurrentPage(1);
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
    if (link) {
      navigate(link);
    }
  };

  return (
    <PageContainer>
      <div className="space-y-6 max-w-5xl mx-auto py-2">
        {/* Header Strip */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-display text-text">
              Notification Inbox
            </h1>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Your personal activity alerts, pending approval notices, and company announcements.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {canAnnounce && (
              <Button
                variant="outline"
                onClick={() => setIsAnnouncementOpen(true)}
                data-testid="open-announcement-modal-btn"
                className="min-h-[44px]"
              >
                <svg
                  className="w-4 h-4 mr-1.5 text-primary-deep"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 5.882V19.24a1.76 1.76 0 0 1-3.417.592l-2.147-6.15M18 8a3 3 0 0 0-3-3H7.5A4.5 4.5 0 0 0 3 9.5v0a4.5 4.5 0 0 0 4.5 4.5H15a3 3 0 0 0 3-3V8z"
                  />
                </svg>
                Broadcast Announcement
              </Button>
            )}

            {unreadCount > 0 && (
              <Button
                variant="primary"
                onClick={() => markAllAsRead()}
                data-testid="inbox-mark-all-read-btn"
                className="min-h-[44px]"
              >
                Mark All as Read
              </Button>
            )}
          </div>
        </div>

        {/* Filters & Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleFilterChange(false)}
              className={`rounded-control px-4 py-2 text-xs sm:text-sm font-semibold transition-colors min-h-[40px] ${
                !unreadOnly
                  ? 'bg-primary-soft text-primary-deep border border-primary-ink/20 shadow-sm'
                  : 'bg-surface text-text-muted border border-border hover:bg-surface-raised hover:text-text'
              }`}
              data-testid="inbox-filter-all"
            >
              All Notifications
            </button>
            <button
              type="button"
              onClick={() => handleFilterChange(true)}
              className={`flex items-center gap-1.5 rounded-control px-4 py-2 text-xs sm:text-sm font-semibold transition-colors min-h-[40px] ${
                unreadOnly
                  ? 'bg-primary-soft text-primary-deep border border-primary-ink/20 shadow-sm'
                  : 'bg-surface text-text-muted border border-border hover:bg-surface-raised hover:text-text'
              }`}
              data-testid="inbox-filter-unread"
            >
              <span>Unread</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary-deep px-1.5 py-0.2 text-[11px] font-bold text-surface">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>

          <div className="text-xs text-text-muted">
            Showing {notifications.length} of {meta.total} notification{meta.total === 1 ? '' : 's'}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="rounded-card border border-negative-ink/20 bg-negative-soft p-4 text-xs text-negative-ink flex items-center justify-between"
            role="alert"
          >
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={() => refresh()}>
              Retry
            </Button>
          </div>
        )}

        {/* Notifications List */}
        {isLoading && notifications.length === 0 ? (
          <div className="p-12 text-center text-text-muted">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
            <p className="text-sm font-medium">Loading your notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div
            className="rounded-card border border-border bg-surface p-12 text-center shadow-card"
            data-testid="inbox-empty-state"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted text-text-muted mb-4">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.6"
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text">
              {unreadOnly ? 'No unread notifications' : 'Your inbox is completely clear'}
            </h3>
            <p className="text-xs sm:text-sm text-text-muted max-w-sm mx-auto mt-1">
              {unreadOnly
                ? "You have reviewed all your alerts. Switch to 'All Notifications' to see historical notifications."
                : 'Whenever leave approvals, task assignments, or team notices occur, they will appear right here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="inbox-notification-list">
            {notifications.map((item) => {
              const style = getNotificationTypeStyle(item.type);
              const isUnread = !item.readAt;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item.id, item.readAt, item.link)}
                  className={`group relative flex flex-col sm:flex-row sm:items-start gap-4 rounded-card border p-4 sm:p-5 transition-all cursor-pointer ${
                    isUnread
                      ? 'border-primary-ink/30 bg-surface-raised shadow-raised'
                      : 'border-border bg-surface hover:bg-surface-muted/40 shadow-card'
                  }`}
                  data-testid={`inbox-notification-row-${item.id}`}
                >
                  {/* Left Icon */}
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.iconBgClass} ${style.iconTextClass}`}
                  >
                    {style.icon}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${style.badgeClass}`}
                      >
                        {style.label}
                      </span>
                      <h3
                        className={`text-sm sm:text-base font-semibold text-text ${
                          isUnread ? 'font-bold' : ''
                        }`}
                      >
                        {item.title}
                      </h3>
                      {isUnread && <span className="flex h-2 w-2 rounded-full bg-primary-deep" />}
                    </div>

                    <p className="text-xs sm:text-sm text-text-muted mt-1 leading-relaxed">
                      {item.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-text-subtle">
                      <span>{formatRelativeTime(item.createdAt)}</span>
                      <span>&bull;</span>
                      <span>
                        {new Date(item.createdAt).toLocaleString('en-US', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </span>
                      {item.link && (
                        <>
                          <span>&bull;</span>
                          <span className="text-primary-deep font-semibold group-hover:underline inline-flex items-center gap-1">
                            Follow action
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions (desktop right / mobile bottom) */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {isUnread && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(item.id);
                        }}
                        className="inline-flex items-center justify-center rounded-input border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-text-muted hover:bg-surface-raised hover:text-text hover:border-border-strong focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
                        title="Mark as read"
                        data-testid={`mark-read-btn-${item.id}`}
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination controls */}
        {meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px]"
            >
              Previous
            </Button>
            <span className="text-xs text-text-muted">
              Page {meta.page} of {meta.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= meta.totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
              className="min-h-[44px]"
            >
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Admin Announcement Modal */}
      {canAnnounce && (
        <AnnouncementModal
          isOpen={isAnnouncementOpen}
          onClose={() => setIsAnnouncementOpen(false)}
          onSend={sendAnnouncement}
        />
      )}
    </PageContainer>
  );
}
