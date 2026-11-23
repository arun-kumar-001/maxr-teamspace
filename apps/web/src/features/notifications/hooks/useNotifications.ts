import { useCallback, useEffect, useState } from 'react';
import type {
  AnnouncementInput,
  AnnouncementResult,
  AppNotification,
  ListNotificationsParams,
  NotificationsMeta,
} from '../types';
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  sendAnnouncement as apiSendAnnouncement,
} from '../api/notificationsApi';

export interface UseNotificationsOptions extends ListNotificationsParams {
  pollIntervalMs?: number;
  autoFetch?: boolean;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { page = 1, pageSize = 20, unread, pollIntervalMs = 0, autoFetch = true } = options;

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [meta, setMeta] = useState<NotificationsMeta>({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    unread: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchNotifications({ page, pageSize, unread });
      setNotifications(response.data);
      setMeta(response.meta);
      setUnreadCount(response.meta.unread);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, unread]);

  useEffect(() => {
    if (autoFetch) {
      loadNotifications();
    }
  }, [autoFetch, loadNotifications]);

  // Periodic polling for badge updates if pollIntervalMs > 0
  useEffect(() => {
    if (!pollIntervalMs || pollIntervalMs <= 0) return;
    const interval = setInterval(() => {
      fetchNotifications({ page, pageSize, unread })
        .then((res) => {
          setNotifications(res.data);
          setMeta(res.meta);
          setUnreadCount(res.meta.unread);
        })
        .catch(() => {
          // Silent catch on background polling
        });
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [page, pageSize, unread, pollIntervalMs]);

  const markAsRead = useCallback(
    async (id: string) => {
      // Optimistic UI update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        const updated = await markNotificationAsRead(id);
        setNotifications((prev) => prev.map((n) => (n.id === id ? updated : n)));
      } catch (err) {
        // Revert/refresh on error
        loadNotifications();
        throw err;
      }
    },
    [loadNotifications],
  );

  const markAllAsRead = useCallback(async () => {
    // Optimistic UI update
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? nowIso })));
    setUnreadCount(0);

    try {
      await markAllNotificationsAsRead();
    } catch (err) {
      loadNotifications();
      throw err;
    }
  }, [loadNotifications]);

  const sendAnnouncement = useCallback(
    async (payload: AnnouncementInput): Promise<AnnouncementResult> => {
      const result = await apiSendAnnouncement(payload);
      await loadNotifications();
      return result;
    },
    [loadNotifications],
  );

  return {
    notifications,
    unreadCount,
    meta,
    isLoading,
    error,
    refresh: loadNotifications,
    markAsRead,
    markAllAsRead,
    sendAnnouncement,
  };
}
