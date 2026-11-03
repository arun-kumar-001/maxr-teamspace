// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROLES } from '@maxr/shared';
import { AuthProvider } from '../../../auth/AuthContext';
import { MeetingsPage } from '../pages/MeetingsPage';
import * as meetingsApi from '../api/meetingsApi';
import * as employeesApi from '../../employees/api/employees';
import type { Meeting, MeetingSummary, MeetingWithOverlaps } from '../types';

vi.mock('../api/meetingsApi', async () => {
  const actual = await vi.importActual<typeof meetingsApi>('../api/meetingsApi');
  return {
    ...actual,
    fetchMeetings: vi.fn(),
    fetchMeetingById: vi.fn(),
    scheduleMeeting: vi.fn(),
    updateMeeting: vi.fn(),
    cancelMeeting: vi.fn(),
    respondMeetingRsvp: vi.fn(),
  };
});

vi.mock('../../employees/api/employees', async () => {
  const actual = await vi.importActual<typeof employeesApi>('../../employees/api/employees');
  return {
    ...actual,
    fetchEmployeeDirectory: vi.fn(),
  };
});

const mockSummaries: MeetingSummary[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    title: 'Architecture Review: Monolith Design',
    organizerEmployeeId: '10000000-0000-0000-0000-000000000001',
    organizerName: 'Sarah Connor',
    startsAt: new Date(Date.now() + 86400000).toISOString(),
    endsAt: new Date(Date.now() + 90000000).toISOString(),
    status: 'scheduled',
    myRole: 'organizer',
    myRsvp: null,
    attendeeCount: 3,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    title: 'Sprint Retrospective & Demo',
    organizerEmployeeId: '20000000-0000-0000-0000-000000000002',
    organizerName: 'John Smith',
    startsAt: new Date(Date.now() + 172800000).toISOString(),
    endsAt: new Date(Date.now() + 176400000).toISOString(),
    status: 'scheduled',
    myRole: 'invitee',
    myRsvp: 'pending',
    attendeeCount: 5,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    title: 'Old Deprecated Sync',
    organizerEmployeeId: '30000000-0000-0000-0000-000000000003',
    organizerName: 'Alice Dev',
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() - 82800000).toISOString(),
    status: 'cancelled',
    myRole: 'invitee',
    myRsvp: 'declined',
    attendeeCount: 2,
  },
];

const mockDetailedMeeting: Meeting = {
  id: '11111111-1111-1111-1111-111111111111',
  title: 'Architecture Review: Monolith Design',
  agenda: 'Review database schemas, Redis cache strategy, and ADR D-18 compliance.',
  minutes: 'Decided on PostgreSQL 16 versioned migrations and plain SQL.',
  organizerEmployeeId: '10000000-0000-0000-0000-000000000001',
  organizerName: 'Sarah Connor',
  startsAt: new Date(Date.now() + 86400000).toISOString(),
  endsAt: new Date(Date.now() + 90000000).toISOString(),
  status: 'scheduled',
  version: 1,
  attendees: [
    {
      employeeId: '20000000-0000-0000-0000-000000000002',
      name: 'John Smith',
      rsvp: 'accepted',
      respondedAt: new Date().toISOString(),
    },
    {
      employeeId: '30000000-0000-0000-0000-000000000003',
      name: 'Alice Dev',
      rsvp: 'pending',
      respondedAt: null,
    },
  ],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Meetings Feature (Issue #45)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(meetingsApi.fetchMeetings).mockResolvedValue({
      data: mockSummaries,
      meta: { page: 1, pageSize: 100, total: 3, totalPages: 1 },
    });

    vi.mocked(meetingsApi.fetchMeetingById).mockResolvedValue(mockDetailedMeeting);

    vi.mocked(employeesApi.fetchEmployeeDirectory).mockResolvedValue({
      data: [
        {
          id: '20000000-0000-0000-0000-000000000002',
          employeeCode: 'EMP-002',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john@example.com',
          phone: null,
          status: 'active',
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des1', title: 'Tech Lead', code: 'TL', level: 3 },
          manager: null,
          joiningDate: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
        {
          id: '30000000-0000-0000-0000-000000000003',
          employeeCode: 'EMP-003',
          firstName: 'Alice',
          lastName: 'Dev',
          email: 'alice@example.com',
          phone: null,
          status: 'active',
          department: { id: 'd1', name: 'Engineering', code: 'ENG' },
          designation: { id: 'des2', title: 'Developer', code: 'DEV', level: 1 },
          manager: null,
          joiningDate: '2024-01-01',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-01',
        },
      ],
      meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    });
  });

  it('renders meetings page with header, KPI stats, and calendar view', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Meetings & Calendar')).toBeInTheDocument();
    expect(screen.getByText('Scheduled Meetings')).toBeInTheDocument();
    expect(screen.getByText('Pending Your RSVP')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('meeting-calendar-view')).toBeInTheDocument();
    });

    // Check calendar event pill
    expect(screen.getByText(/Architecture Review: Monolith Design/)).toBeInTheDocument();
  });

  it('switches between calendar view and agenda list view', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('meeting-calendar-view')).toBeInTheDocument();
    });

    // Switch to Agenda List
    fireEvent.click(screen.getByRole('radio', { name: 'Agenda List' }));

    await waitFor(() => {
      expect(screen.getByTestId('meeting-agenda-list')).toBeInTheDocument();
    });

    expect(screen.getByText('Architecture Review: Monolith Design')).toBeInTheDocument();
    expect(screen.getByText('Sprint Retrospective & Demo')).toBeInTheDocument();
  });

  it('filters meetings by search text', async () => {
    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('meeting-calendar-view')).toBeInTheDocument();
    });

    // Switch to agenda list for easy text verification
    fireEvent.click(screen.getByRole('radio', { name: 'Agenda List' }));

    await waitFor(() => {
      expect(screen.getByText('Architecture Review: Monolith Design')).toBeInTheDocument();
      expect(screen.getByText('Sprint Retrospective & Demo')).toBeInTheDocument();
    });

    // Type query in search
    const searchInput = screen.getByTestId('meeting-search-input');
    fireEvent.change(searchInput, { target: { value: 'Retrospective' } });

    await waitFor(() => {
      expect(screen.queryByText('Architecture Review: Monolith Design')).not.toBeInTheDocument();
      expect(screen.getByText('Sprint Retrospective & Demo')).toBeInTheDocument();
    });
  });

  it('hides Schedule Meeting button for Staff and shows for Admin/Lead', () => {
    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.queryByTestId('schedule-meeting-button')).not.toBeInTheDocument();
    unmount();

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.TEAM_LEAD} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('schedule-meeting-button')).toBeInTheDocument();
  });

  it('validates and schedules a meeting, showing overlap alert if attendees conflict', async () => {
    const mockScheduleResult: MeetingWithOverlaps = {
      meeting: mockDetailedMeeting,
      overlaps: [
        {
          employeeId: '20000000-0000-0000-0000-000000000002',
          meetingId: '99999999-9999-9999-9999-999999999999',
        },
      ],
    };
    vi.mocked(meetingsApi.scheduleMeeting).mockResolvedValue(mockScheduleResult);

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByTestId('schedule-meeting-button'));

    await waitFor(() => {
      expect(screen.getByTestId('meeting-form')).toBeInTheDocument();
    });

    // Fill title
    fireEvent.change(screen.getByTestId('meeting-title-input'), {
      target: { value: 'Sprint Planning Session' },
    });

    // Select an attendee
    await waitFor(() => {
      expect(
        screen.getByTestId('invitee-toggle-20000000-0000-0000-0000-000000000002'),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('invitee-toggle-20000000-0000-0000-0000-000000000002'));

    // Submit
    fireEvent.click(screen.getByTestId('submit-meeting-btn'));

    await waitFor(() => {
      expect(meetingsApi.scheduleMeeting).toHaveBeenCalled();
    });

    // Overlap banner should show John Smith
    await waitFor(() => {
      expect(screen.getByTestId('overlap-warning-banner')).toBeInTheDocument();
      expect(
        within(screen.getByTestId('overlap-warning-banner')).getByText('John Smith'),
      ).toBeInTheDocument();
    });
  });

  it('opens meeting detail modal, shows agenda, attendees and allows editing minutes', async () => {
    vi.mocked(meetingsApi.updateMeeting).mockResolvedValue({
      meeting: { ...mockDetailedMeeting, minutes: 'Updated minutes notes' },
      overlaps: [],
    });

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.ADMIN} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Switch to agenda list
    fireEvent.click(screen.getByRole('radio', { name: 'Agenda List' }));

    await waitFor(() => {
      expect(
        screen.getByTestId('meeting-card-11111111-1111-1111-1111-111111111111'),
      ).toBeInTheDocument();
    });

    // Click meeting card
    fireEvent.click(screen.getByText('Architecture Review: Monolith Design'));

    await waitFor(() => {
      expect(screen.getByTestId('meeting-detail-modal')).toBeInTheDocument();
      expect(screen.getByTestId('meeting-agenda-text')).toHaveTextContent(
        'Review database schemas, Redis cache strategy',
      );
      expect(screen.getByTestId('meeting-minutes-text')).toHaveTextContent(
        'Decided on PostgreSQL 16 versioned migrations',
      );
      expect(
        within(screen.getByTestId('meeting-detail-modal')).getByText('John Smith'),
      ).toBeInTheDocument();
    });
  });

  it('handles quick RSVP response from Agenda List view', async () => {
    vi.mocked(meetingsApi.respondMeetingRsvp).mockResolvedValue({
      rsvp: 'accepted',
    });

    render(
      <MemoryRouter>
        <AuthProvider initialRole={ROLES.STAFF} persistSession={false}>
          <MeetingsPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    // Switch to agenda
    fireEvent.click(screen.getByRole('radio', { name: 'Agenda List' }));

    await waitFor(() => {
      expect(
        screen.getByTestId('quick-rsvp-22222222-2222-2222-2222-222222222222-accepted'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('quick-rsvp-22222222-2222-2222-2222-222222222222-accepted'));

    await waitFor(() => {
      expect(meetingsApi.respondMeetingRsvp).toHaveBeenCalledWith(
        '22222222-2222-2222-2222-222222222222',
        'accepted',
      );
    });
  });
});
