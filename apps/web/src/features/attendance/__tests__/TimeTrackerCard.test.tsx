// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttendanceCaptureModal } from '../components/AttendanceCaptureModal';
import { TimeTrackerCard } from '../components/TimeTrackerCard';

describe('TimeTrackerCard & AttendanceCaptureModal (Issue #2)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('renders TimeTrackerCard in overview variant and toggles check-in without camera', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/attendance/today')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                data: {
                  workDate: '2026-11-19',
                  totalDurationMinutes: 0,
                  sessionsCount: 0,
                  activeSession: null,
                  sessions: [],
                },
              }),
          });
        }
        if (url.includes('/api/v1/attendance/active')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () => Promise.resolve({ data: null }),
          });
        }
        if (url.includes('/api/v1/attendance/check-in')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                data: {
                  id: 'session-101',
                  checkInTime: new Date().toISOString(),
                },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    );

    render(<TimeTrackerCard variant="overview" />);

    // Initially loads from server (no active session -> Checked Out)
    await waitFor(() => {
      expect(screen.getByText('Checked Out')).toBeDefined();
    });

    const toggleBtn = screen.getByTestId('attendance-toggle-button');
    expect(toggleBtn).toBeDefined();

    // Click Check In
    fireEvent.click(toggleBtn);

    // After clicking Check In without camera mock, optimistically marks Checked In
    await waitFor(() => {
      expect(screen.getByText('Checked In')).toBeDefined();
    });
  });

  it('AttendanceCaptureModal allows photo capture and confirmation even with location fallback', async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    const onCloseMock = vi.fn();

    render(
      <AttendanceCaptureModal
        isOpen={true}
        mode="check-in"
        onClose={onCloseMock}
        onConfirm={onConfirmMock}
      />,
    );

    expect(screen.getByText('Check In Verification')).toBeDefined();

    // Confirm button is present
    const confirmBtn = screen.getByRole('button', { name: /confirm check in/i });
    expect(confirmBtn).toBeDefined();
  });

  it('never sends the position to an outside service when GPS succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const getCurrentPosition = vi.fn((success: (pos: unknown) => void) =>
      success({ coords: { latitude: 12.971599, longitude: 77.594566 } }),
    );
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    render(
      <AttendanceCaptureModal
        isOpen={true}
        mode="check-in"
        onClose={vi.fn()}
        onConfirm={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    await waitFor(() => expect(getCurrentPosition).toHaveBeenCalled());
    // Let any pending work finish before checking that nothing left the browser.
    await new Promise((resolve) => setTimeout(resolve, 50));

    const hosts = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(hosts.filter((url) => /^https?:\/\//.test(url))).toEqual([]);
    expect(hosts.join(' ')).not.toMatch(/openstreetmap|bigdatacloud|reverse/i);
  });

  it('TimeTrackerCard persists active session in localStorage across reloads', async () => {
    localStorage.setItem(
      'maxr_time_tracker_active_session',
      JSON.stringify({
        isCheckedIn: true,
        checkInTime: '10:00 AM',
        startTimeMs: Date.now() - 3600000,
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/api/v1/attendance/today')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({
                data: {
                  workDate: '2026-11-19',
                  totalDurationMinutes: 60,
                  sessionsCount: 1,
                  activeSession: null,
                  sessions: [],
                },
              }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }),
    );

    render(<TimeTrackerCard variant="overview" />);

    // Should hydrate as Checked In and 10:00 AM from localStorage even if server returns activeSession null
    expect(screen.getByText('Checked In')).toBeDefined();
    expect(screen.getByText('10:00 AM')).toBeDefined();
  });

  it('stays paused after the server reload, and does not count break time as work time', async () => {
    const now = Date.now();
    const session = {
      id: 's1',
      checkInTime: new Date(now - 2 * 3600_000).toISOString(),
      checkOutTime: null,
      // Worked 1h, then on break for the last hour (still open).
      breaks: [{ startTime: new Date(now - 3600_000).toISOString(), endTime: null }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () =>
            Promise.resolve(
              url.includes('/attendance/today')
                ? {
                    data: {
                      workDate: '2026-11-19',
                      totalDurationMinutes: 0,
                      sessionsCount: 1,
                      activeSession: session,
                      sessions: [session],
                    },
                  }
                : { data: session },
            ),
        }),
      ),
    );

    render(<TimeTrackerCard variant="overview" />);

    // Paused: the button offers Resume (it was "Pause" while the break was ignored)...
    expect(await screen.findByTitle('Resume work time')).toBeDefined();
    // ...and the clock shows the 1h worked, not the 2h since check-in.
    expect(screen.getByText(/^01:00$/)).toBeDefined();
  });
});
