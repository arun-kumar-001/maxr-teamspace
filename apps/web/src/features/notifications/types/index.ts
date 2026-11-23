export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  unread: number;
}

export interface ListNotificationsResponse {
  data: AppNotification[];
  meta: NotificationsMeta;
}

export interface ListNotificationsParams {
  page?: number;
  pageSize?: number;
  unread?: boolean;
}

export interface AnnouncementInput {
  title: string;
  message: string;
}

export interface AnnouncementResult {
  recipients: number;
}
