import { useCallback, useEffect, useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/StatusPill';
import { AttendanceApiClient, defaultAttendanceApi } from '../api/attendanceApi';
import { AttendanceRecord, TodayAttendanceSummary } from '../types/attendance';

export interface AttendanceWidgetProps {
  api?: AttendanceApiClient;
  initialSummary?: TodayAttendanceSummary | null;
  className?: string;
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatElapsedTimer(checkInIso: string, now: Date): string {
  const diffMs = Math.max(0, now.getTime() - new Date(checkInIso).getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function AttendanceWidget({
  api = defaultAttendanceApi,
  initialSummary = null,
  className = '',
}: AttendanceWidgetProps) {
  const [summary, setSummary] = useState<TodayAttendanceSummary | null>(initialSummary);
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(
    initialSummary?.activeSession ?? null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(!initialSummary);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Clock tick every second for live time & active session duration
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const loadSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await api.getTodaySummary();
      setSummary(data);
      setActiveSession(data.activeSession);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (!initialSummary) {
      void loadSummary();
    }
  }, [initialSummary, loadSummary]);

  const handleCheckIn = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const session = await api.checkIn();
      setActiveSession(session);
      setSummary((prev) =>
        prev
          ? { ...prev, activeSession: session, status: 'PRESENT' }
          : {
              date: new Date().toISOString().slice(0, 10),
              activeSession: session,
              completedSessions: [],
              totalWorkedMinutes: 0,
              status: 'PRESENT',
            },
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Check-in failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      const completed = await api.checkOut();
      setActiveSession(null);
      setSummary((prev) =>
        prev
          ? {
              ...prev,
              activeSession: null,
              completedSessions: [...prev.completedSessions, completed],
              totalWorkedMinutes: prev.totalWorkedMinutes + (completed.durationMinutes ?? 0),
              status: 'ON_LEAVE',
            }
          : null,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Check-out failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCheckedIn = !!activeSession;

  return (
    <div
      className={`p-6 bg-surface border border-slate-200 rounded-xl shadow-sm ${className}`}
      data-testid="attendance-widget"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Today's Attendance</h2>
          <p className="text-xs text-slate-500">
            {currentTime.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isCheckedIn ? 'success' : 'neutral'}>
            {isCheckedIn ? 'Session In Progress' : 'Checked Out'}
          </Badge>
        </div>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg flex items-center justify-between"
        >
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="text-rose-500 hover:text-rose-700 text-xs font-semibold ml-2"
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Clock & Elapsed Timer Display */}
      <div className="py-6 flex flex-col items-center justify-center text-center">
        <div className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 font-mono">
          {currentTime.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </div>
        {isCheckedIn ? (
          <div className="mt-2 text-sm text-teal-600 font-medium">
            Active session timer:{' '}
            <span className="font-mono font-bold">
              {formatElapsedTimer(activeSession.checkInTime, currentTime)}
            </span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-slate-500">
            No active session. Click Check In to start your workday.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <Button
          variant="primary"
          onClick={handleCheckIn}
          disabled={isCheckedIn || isSubmitting || isLoading}
          className="w-full min-h-[44px] bg-teal-500 hover:bg-teal-600 text-white font-medium shadow-sm transition-colors"
          data-testid="attendance-checkin-btn"
        >
          {isSubmitting && !isCheckedIn ? 'Checking In...' : 'Check In'}
        </Button>
        <Button
          variant="outline"
          onClick={handleCheckOut}
          disabled={!isCheckedIn || isSubmitting || isLoading}
          className="w-full min-h-[44px] border-slate-300 text-slate-700 hover:bg-slate-50 font-medium transition-colors"
          data-testid="attendance-checkout-btn"
        >
          {isSubmitting && isCheckedIn ? 'Checking Out...' : 'Check Out'}
        </Button>
      </div>

      {/* Today's Summary Metrics */}
      <div className="mt-6 pt-4 border-t border-slate-100 grid grid-cols-2 gap-4 text-center">
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Total Worked
          </p>
          <p
            className="text-lg font-bold text-slate-900 mt-1"
            data-testid="attendance-total-worked"
          >
            {formatDuration(summary?.totalWorkedMinutes ?? 0)}
          </p>
        </div>
        <div className="p-3 bg-slate-50 rounded-lg">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
            Completed Sessions
          </p>
          <p
            className="text-lg font-bold text-slate-900 mt-1"
            data-testid="attendance-completed-count"
          >
            {summary?.completedSessions?.length ?? 0}
          </p>
        </div>
      </div>
    </div>
  );
}
