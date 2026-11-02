// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ROLES } from '@maxr/shared';
import * as authContext from '../../../auth/AuthContext';
import * as notificationsApi from '../api/notificationsApi';
import { NotificationBell } from '../components/NotificationBell';
import { NotificationsInboxPage } from '../pages/NotificationsInboxPage';
import type { AppNotification, ListNotificationsResponse } from '../types';

vi.mock('../api/notificationsApi');

const mockNotifications: AppNotification[] = [
  {
    id: 'notif-1',
    type: 'approval.requested',
    title: 'Leave request waiting for your decision',
    body: 'Alice Staff requested 3 days of Annual Leave from Nov 10 to Nov 12.',
    link: '/approvals/approval-1',
    readAt: null,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
  },
  {
    id: 'notif-2',
    type: 'task.assigned',
    title: 'New task assigned to you',
    body: 'You have been assigned to: Update onboarding documentation.',
    link: '/tasks/task-1',
    readAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
    createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'notif-3',
    type: 'announcement',
    title: 'Company All-Hands Meeting',
    body: 'Join the quarterly all-hands meeting on Google Meet at 4:00 PM.',
    link: null,
    readAt: null,
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  },
];

const mockListResponse: ListNotificationsResponse = {
  data: mockNotifications,
  meta: {
    page: 1,
    pageSize: 20,
    total: 3,
    totalPages: 1,
    unread: 2,
  },
};

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(mockListResponse);
    vi.mocked(notificationsApi.markNotificationAsRead).mockImplementation(async (id) => {
      const found = mockNotifications.find((n) => n.id === id) ?? mockNotifications[0]!;
      return { ...found, readAt: new Date().toISOString() };
    });
    vi.mocked(notificationsApi.markAllNotificationsAsRead).mockResolvedValue({ updated: 2 });
  });

  it('renders bell button with live unread count badge', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    const bellBtn = screen.getByTestId('notification-bell-button');
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('notification-badge-count')).toHaveTextContent('2');
    });
  });

  it('toggles dropdown popover on click and lists recent notifications', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    const bellBtn = screen.getByTestId('notification-bell-button');
    fireEvent.click(bellBtn);

    await waitFor(() => {
      expect(screen.getByTestId('notifications-dropdown-menu')).toBeInTheDocument();
      expect(screen.getByText('Leave request waiting for your decision')).toBeInTheDocument();
      expect(screen.getByText('New task assigned to you')).toBeInTheDocument();
    });
  });

  it('allows marking all notifications as read in the dropdown', async () => {
    render(
      <MemoryRouter>
        <NotificationBell />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('notification-bell-button'));

    await waitFor(() => {
      expect(screen.getByTestId('mark-all-read-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mark-all-read-btn'));

    await waitFor(() => {
      expect(notificationsApi.markAllNotificationsAsRead).toHaveBeenCalledTimes(1);
    });
  });
});

describe('NotificationsInboxPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationsApi.fetchNotifications).mockResolvedValue(mockListResponse);
    vi.mocked(notificationsApi.markNotificationAsRead).mockImplementation(async (id) => {
      const found = mockNotifications.find((n) => n.id === id) ?? mockNotifications[0]!;
      return { ...found, readAt: new Date().toISOString() };
    });
    vi.mocked(notificationsApi.markAllNotificationsAsRead).mockResolvedValue({ updated: 2 });
    vi.mocked(notificationsApi.sendAnnouncement).mockResolvedValue({ recipients: 10 });
  });

  it('renders full inbox with notifications and category badges', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-1',
        employeeId: 'emp-1',
        email: 'staff@example.com',
        name: 'Alice Staff',
        role: ROLES.STAFF,
        roles: [ROLES.STAFF],
        permissions: ['notifications.read_own'],
        avatarInitials: 'AS',
      },
      role: ROLES.STAFF,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsInboxPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Notification Inbox')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Leave request waiting for your decision')).toBeInTheDocument();
      expect(screen.getByText('Company All-Hands Meeting')).toBeInTheDocument();
      expect(screen.getByText('Approval')).toBeInTheDocument();
      expect(screen.getByText('Task')).toBeInTheDocument();
      expect(screen.getByText('Announcement')).toBeInTheDocument();
    });
  });

  it('allows marking an individual notification as read', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'usr-1',
        employeeId: 'emp-1',
        email: 'staff@example.com',
        name: 'Alice Staff',
        role: ROLES.STAFF,
        roles: [ROLES.STAFF],
        permissions: ['notifications.read_own'],
        avatarInitials: 'AS',
      },
      role: ROLES.STAFF,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsInboxPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('mark-read-btn-notif-1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('mark-read-btn-notif-1'));

    await waitFor(() => {
      expect(notificationsApi.markNotificationAsRead).toHaveBeenCalledWith('notif-1');
    });
  });

  it('shows Broadcast Announcement button for Admin and submits announcement modal', async () => {
    vi.spyOn(authContext, 'useAuth').mockReturnValue({
      user: {
        id: 'adm-1',
        employeeId: 'emp-admin',
        email: 'admin@example.com',
        name: 'System Admin',
        role: ROLES.ADMIN,
        roles: [ROLES.ADMIN],
        permissions: ['notifications.read_own', 'notifications.announce'],
        avatarInitials: 'SA',
      },
      role: ROLES.ADMIN,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    });

    render(
      <MemoryRouter>
        <NotificationsInboxPage />
      </MemoryRouter>,
    );

    const announceBtn = screen.getByTestId('open-announcement-modal-btn');
    expect(announceBtn).toBeInTheDocument();

    fireEvent.click(announceBtn);

    expect(screen.getByTestId('announcement-form')).toBeInTheDocument();

    fireEvent.change(screen.getByTestId('announcement-title-input'), {
      target: { value: 'New Office Policy' },
    });
    fireEvent.change(screen.getByTestId('announcement-message-input'), {
      target: { value: 'Please review the updated hybrid work schedule.' },
    });

    fireEvent.click(screen.getByTestId('submit-announcement-btn'));

    await waitFor(() => {
      expect(notificationsApi.sendAnnouncement).toHaveBeenCalledWith({
        title: 'New Office Policy',
        message: 'Please review the updated hybrid work schedule.',
      });
      expect(screen.getByTestId('announcement-success-message')).toBeInTheDocument();
    });
  });
});
