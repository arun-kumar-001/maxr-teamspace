import { apiFetch } from '../../../api/client';
import type {
  AnnouncementInput,
  AnnouncementResult,
  AppNotification,
  ListNotificationsParams,
  ListNotificationsResponse,
} from '../types';

export class NotificationsApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'NotificationsApiError';
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API request failed with status ${res.status}`;
    let code: string | undefined;
    try {
      const errorData = await res.json();
      if (errorData?.error?.message) {
        errorMsg = errorData.error.message;
        code = errorData.error.code;
      }
    } catch {
      // response not JSON
    }
    throw new NotificationsApiError(errorMsg, res.status, code);
  }
  return res.json() as Promise<T>;
}

export async function fetchNotifications(
  params?: ListNotificationsParams,
): Promise<ListNotificationsResponse> {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.unread !== undefined) query.set('unread', String(params.unread));

  const url = `/api/v1/notifications${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await apiFetch(url);
  return handleResponse<ListNotificationsResponse>(res);
}

export async function markNotificationAsRead(id: string): Promise<AppNotification> {
  const res = await apiFetch(`/api/v1/notifications/${id}/read`, {
    method: 'POST',
  });
  const body = await handleResponse<{ data: AppNotification }>(res);
  return body.data;
}

export async function markAllNotificationsAsRead(): Promise<{ updated: number }> {
  const res = await apiFetch('/api/v1/notifications/read-all', {
    method: 'POST',
  });
  const body = await handleResponse<{ data: { updated: number } }>(res);
  return body.data;
}

export async function sendAnnouncement(
  payload: AnnouncementInput,
  idempotencyKey?: string,
): Promise<AnnouncementResult> {
  const key = idempotencyKey || crypto.randomUUID();
  const res = await apiFetch('/api/v1/notifications/announcements', {
    method: 'POST',
    headers: {
      'Idempotency-Key': key,
    },
    body: JSON.stringify(payload),
  });
  const body = await handleResponse<{ data: AnnouncementResult }>(res);
  return body.data;
}
