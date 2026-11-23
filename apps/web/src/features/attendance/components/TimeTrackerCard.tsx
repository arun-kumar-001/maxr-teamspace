import { useEffect, useRef, useState } from 'react';
import {
  checkIn,
  checkOut,
  endBreak,
  fetchActiveSession,
  fetchTodayAttendance,
  startBreak,
} from '../api/attendance';
import type { AttendanceLocation } from '../types';
import { AttendanceCaptureModal } from './AttendanceCaptureModal';

export interface TimeTrackerCardProps {
  /** Visual card style matching either Profile Portal or Overview dashboard cards. */
  variant?: 'profile' | 'overview';
  /** Route opened by the top-right arrow button on Profile Portal. */
  attendanceRoute?: string;
  /** Optional SPA navigation callback; falls back to pushState + popstate when omitted. */
  onNavigate?: (path: string) => void;
  /** Extra Tailwind classes for height/layout alignment. */
  className?: string;
}

const ATTENDANCE_STORAGE_KEY = 'maxr_time_tracker_active_session';

interface LocalSession {
  isCheckedIn: boolean;
  checkInTime: string;
  startTimeMs: number;
}

function getLocalSession(): LocalSession | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(ATTENDANCE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSession;
    if (parsed.startTimeMs && Date.now() - parsed.startTimeMs < 24 * 60 * 60 * 1000) {
      return parsed;
    }
    localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
    return null;
  } catch {
    return null;
  }
}

function saveLocalSession(session: LocalSession): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(ATTENDANCE_STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Ignore storage quota errors
  }
}

function clearLocalSession(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.removeItem(ATTENDANCE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

function formatWorkTime(totalSec: number) {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return {
    hoursMinutes: `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
    seconds: String(secs).padStart(2, '0'),
  };
}

/**
 * Shared Time Tracker card used across My Profile and Admin Overview.
 * Syncs live session state with `/api/v1/attendance` while preserving instant UI responsiveness.
 */
export function TimeTrackerCard({
  variant = 'profile',
  attendanceRoute = '/attendance',
  onNavigate,
  className = 'h-64 sm:h-72',
}: TimeTrackerCardProps) {
  const [isCheckedIn, setIsCheckedIn] = useState(() => {
    const local = getLocalSession();
    return local ? local.isCheckedIn : true;
  });
  const [checkInTime, setCheckInTime] = useState(() => {
    const local = getLocalSession();
    return local ? local.checkInTime : '09:15 AM';
  });
  const [timeTrackerRunning, setTimeTrackerRunning] = useState(() => {
    const local = getLocalSession();
    return local ? local.isCheckedIn : true;
  });
  const [secondsElapsed, setSecondsElapsed] = useState(() => {
    const local = getLocalSession();
    if (local?.startTimeMs) {
      return Math.max(0, Math.floor((Date.now() - local.startTimeMs) / 1000));
    }
    return 9314;
  });
  const [todayTotalMinutes, setTodayTotalMinutes] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureMode, setCaptureMode] = useState<'check-in' | 'check-out'>('check-in');

  const loadFromServer = async () => {
    try {
      const summary = await fetchTodayAttendance();
      setTodayTotalMinutes(summary.totalDurationMinutes ?? 0);
      let active = summary.activeSession;
      if (!active) {
        try {
          active = await fetchActiveSession();
        } catch {
          // ignore
        }
      }
      if (active?.checkInTime) {
        const start = new Date(active.checkInTime);
        const activeElapsedSecs = Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000));
        const formattedCheckIn = start.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        setCheckInTime(formattedCheckIn);
        setSecondsElapsed(activeElapsedSecs);
        setIsCheckedIn(true);
        const isOnBreak = Boolean(
          summary.activeSession?.breakStartTime && !summary.activeSession?.breakEndTime,
        );
        setTimeTrackerRunning(!isOnBreak);
        saveLocalSession({
          isCheckedIn: true,
          checkInTime: formattedCheckIn,
          startTimeMs: start.getTime(),
        });
      } else {
        const local = getLocalSession();
        if (local && local.isCheckedIn) {
          const activeElapsedSecs = Math.max(
            0,
            Math.floor((Date.now() - local.startTimeMs) / 1000),
          );
          setCheckInTime(local.checkInTime);
          setSecondsElapsed(activeElapsedSecs);
          setIsCheckedIn(true);
          setTimeTrackerRunning(true);
        } else {
          setSecondsElapsed(0);
          setCheckInTime('--:--');
          setIsCheckedIn(false);
          setTimeTrackerRunning(false);
        }
      }
    } catch {
      // Offline fallback: sync with localStorage
      const local = getLocalSession();
      if (local && local.isCheckedIn) {
        const activeElapsedSecs = Math.max(0, Math.floor((Date.now() - local.startTimeMs) / 1000));
        setCheckInTime(local.checkInTime);
        setSecondsElapsed(activeElapsedSecs);
        setIsCheckedIn(true);
        setTimeTrackerRunning(true);
      }
    }
  };

  useEffect(() => {
    void loadFromServer();
    const handleSync = () => {
      void loadFromServer();
    };
    window.addEventListener('maxr:attendance-updated', handleSync);
    return () => window.removeEventListener('maxr:attendance-updated', handleSync);
  }, []);

  useEffect(() => {
    if (!timeTrackerRunning) return;
    const trackerInterval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(trackerInterval);
  }, [timeTrackerRunning]);

  const handleAttendanceToggle = async () => {
    if (busy) return;
    const hasCamera =
      typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    if (hasCamera) {
      setCaptureMode(isCheckedIn ? 'check-out' : 'check-in');
      setCaptureOpen(true);
      return;
    }

    const nextCheckedIn = !isCheckedIn;
    setIsCheckedIn(nextCheckedIn);
    setTimeTrackerRunning(nextCheckedIn);
    const now = new Date();
    const formattedCheckIn = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    if (nextCheckedIn) {
      setCheckInTime(formattedCheckIn);
      setSecondsElapsed(0);
      saveLocalSession({
        isCheckedIn: true,
        checkInTime: formattedCheckIn,
        startTimeMs: now.getTime(),
      });
    } else {
      setCheckInTime('--:--');
      setSecondsElapsed(0);
      clearLocalSession();
    }

    setBusy(true);
    try {
      if (nextCheckedIn) {
        await checkIn();
      } else {
        await checkOut();
      }
      await loadFromServer();
      window.dispatchEvent(new Event('maxr:attendance-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Keep optimistic UI state when offline/in unit tests
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCapture = async (payload: {
    location: AttendanceLocation;
    photoDataUrl?: string;
  }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);

    const now = new Date();
    const formattedCheckIn = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });

    try {
      // Clean location object to match attendanceLocationSchema.strict()
      const cleanLocation: AttendanceLocation = {
        workMode: payload.location?.workMode ?? 'office',
      };
      if (typeof payload.location?.latitude === 'number' && !isNaN(payload.location.latitude)) {
        cleanLocation.latitude = payload.location.latitude;
      }
      if (typeof payload.location?.longitude === 'number' && !isNaN(payload.location.longitude)) {
        cleanLocation.longitude = payload.location.longitude;
      }
      if (payload.location?.address) {
        cleanLocation.address = payload.location.address.slice(0, 250);
      }

      const cleanPhoto = payload.photoDataUrl
        ? payload.photoDataUrl.trim().replace(/[\r\n\s]+/g, '')
        : '';

      if (captureMode === 'check-in') {
        // Optimistically set UI state immediately so timer runs instantly
        setSecondsElapsed(0);
        setIsCheckedIn(true);
        setTimeTrackerRunning(true);
        setCheckInTime(formattedCheckIn);
        saveLocalSession({
          isCheckedIn: true,
          checkInTime: formattedCheckIn,
          startTimeMs: now.getTime(),
        });

        try {
          await checkIn({
            location: cleanLocation,
            photoDataUrl: cleanPhoto || undefined,
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : '';
          if (!msg.toLowerCase().includes('already exists')) {
            console.warn('Attendance check-in API call failed, kept local session:', err);
          }
        }
      } else {
        setSecondsElapsed(0);
        setCheckInTime('--:--');
        setIsCheckedIn(false);
        setTimeTrackerRunning(false);
        clearLocalSession();

        try {
          await checkOut({
            location: cleanLocation,
            photoDataUrl: cleanPhoto || undefined,
          });
        } catch (err: unknown) {
          console.warn('Attendance check-out API call failed, kept local state:', err);
        }
      }

      setCaptureOpen(false);
      await loadFromServer();
      window.dispatchEvent(new Event('maxr:attendance-updated'));
      window.dispatchEvent(new Event('storage'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const handlePausePlay = async () => {
    // Cannot start timer without official active check-in
    if (busy || !isCheckedIn) return;
    const isPausing = timeTrackerRunning;
    setTimeTrackerRunning(!isPausing);
    setBusy(true);
    try {
      if (isPausing) {
        try {
          await startBreak();
        } catch {
          // Keep optimistic pause
        }
      } else {
        try {
          await endBreak();
        } catch {
          // Keep optimistic resume
        }
      }
      await loadFromServer();
      window.dispatchEvent(new Event('maxr:attendance-updated'));
      window.dispatchEvent(new Event('storage'));
    } catch {
      // Keep optimistic pause/resume state
    } finally {
      setBusy(false);
    }
  };

  const { hoursMinutes, seconds } = formatWorkTime(secondsElapsed);

  const cardSurfaceClass =
    variant === 'overview'
      ? 'p-4 sm:p-5 bg-white border border-border/80 rounded-card shadow-xs flex flex-col justify-between min-w-0 transition-all duration-200 hover:shadow-card hover:-translate-y-0.5 hover:border-border'
      : 'rounded-[26px] p-5 flex flex-col justify-between shadow-xs hover:-translate-y-1.5 hover:shadow-xl transition-all duration-300 ease-out bg-white border border-border/80';

  const timerRing = (ringSizeClass: string, timeTextClass: string) => (
    <div className="relative flex items-center justify-center shrink-0">
      <svg className={`${ringSizeClass} -rotate-90`} viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke="rgba(8, 11, 12, 0.12)"
          strokeWidth="4"
          strokeDasharray="2 3"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={isCheckedIn ? 'rgb(85, 205, 179)' : 'rgba(8, 11, 12, 0.2)'}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray="251.2"
          strokeDashoffset={Math.max(251.2 * (1 - Math.min(secondsElapsed / 28800, 1)), 25)}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="flex items-baseline gap-0.5">
          <p
            className={`${timeTextClass} font-bold font-display leading-tight tracking-tight text-text`}
          >
            {hoursMinutes}
          </p>
          <span
            className="text-xs font-display font-bold tabular-nums animate-pulse"
            style={{ color: isCheckedIn ? 'rgb(85, 205, 179)' : 'rgba(8, 11, 12, 0.4)' }}
          >
            :{seconds}
          </span>
        </div>
        <p className="text-[10px] flex items-center gap-1.5 text-text-muted">
          {isCheckedIn && timeTrackerRunning ? (
            <span className="relative flex h-2 w-2">
              <span
                className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                style={{ backgroundColor: 'rgb(85, 205, 179)' }}
              />
              <span
                className="relative inline-flex rounded-full h-2 w-2"
                style={{ backgroundColor: 'rgb(85, 205, 179)' }}
              />
            </span>
          ) : (
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: 'rgba(8, 11, 12, 0.3)' }}
            />
          )}
          {isCheckedIn ? 'Work Time' : 'Session Paused'}
        </p>
      </div>
    </div>
  );

  const actionControls = (alignClass: string) => (
    <div className={`flex items-center ${alignClass} gap-2 flex-wrap`}>
      <button
        type="button"
        onClick={() => void handleAttendanceToggle()}
        disabled={busy}
        data-testid="attendance-toggle-button"
        className={`px-4 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all hover:scale-105 active:scale-95 duration-200 disabled:opacity-70 ${
          isCheckedIn && timeTrackerRunning ? 'animate-pulse-ring' : 'hover:opacity-90'
        }`}
        style={{
          backgroundColor: isCheckedIn ? 'rgb(8, 11, 12)' : 'rgb(85, 205, 179)',
          color: isCheckedIn ? 'rgb(255, 255, 255)' : 'rgb(8, 11, 12)',
          border: '1px solid rgba(8, 11, 12, 0.12)',
        }}
        aria-label={
          isCheckedIn ? 'Check Out of attendance session' : 'Check In to attendance session'
        }
      >
        <span className="text-[10px]">{isCheckedIn ? '⏹' : '▷'}</span>
        <span>{isCheckedIn ? 'Check Out' : 'Check In'}</span>
      </button>

      <button
        type="button"
        onClick={() => void handlePausePlay()}
        disabled={busy || !isCheckedIn}
        className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center justify-center shadow-xs hover:opacity-90 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        style={{
          backgroundColor: !timeTrackerRunning ? 'rgb(73, 53, 72)' : 'rgb(244, 247, 246)',
          color: !timeTrackerRunning ? 'rgb(255, 255, 255)' : 'rgb(8, 11, 12)',
          border: '1px solid rgba(8, 11, 12, 0.12)',
        }}
        aria-label={
          !isCheckedIn
            ? 'Check in first to enable timer'
            : timeTrackerRunning
              ? 'Pause work time'
              : 'Resume work time'
        }
        title={
          !isCheckedIn
            ? 'Check in first to enable timer'
            : timeTrackerRunning
              ? 'Pause work time'
              : 'Resume work time'
        }
      >
        <span>{timeTrackerRunning ? '❚❚' : '▷'}</span>
      </button>
    </div>
  );

  if (variant === 'overview') {
    return (
      <div className={`${cardSurfaceClass} ${className}`}>
        {/* Header matching Attendance Overview & Task Overview */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
              <svg
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9.25" />
                <path d="M12 7v5.2l3.4 2" />
              </svg>
            </span>
            <h2 className="text-sm font-bold text-text truncate">Time tracker</h2>
          </div>
          <p
            className={`text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
              isCheckedIn ? 'text-primary-ink' : 'text-text-muted'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </p>
        </div>

        {/* Left: Large Circular Timer | Right: Check-In Time + Action Buttons */}
        <div className="flex items-center justify-between gap-4 my-auto py-3 min-w-0">
          {timerRing('w-36 h-36', 'text-[26px]')}

          <div className="flex-1 min-w-0 flex flex-col justify-center gap-3">
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted block">
                Check-in time
              </span>
              <p className="text-2xl sm:text-[26px] font-bold font-display leading-tight whitespace-nowrap text-text mt-0.5">
                {checkInTime}
              </p>
            </div>
            {actionControls('justify-start')}
          </div>
        </div>

        <div className="pt-2.5 border-t border-border/80 flex items-center justify-between text-xs text-text-muted">
          <span>
            {todayTotalMinutes !== null && todayTotalMinutes > 0
              ? `Today total: ${Math.floor(todayTotalMinutes / 60)}h ${String(todayTotalMinutes % 60).padStart(2, '0')}m`
              : 'Target: 8.5h today'}
          </span>
          <span className="font-semibold text-primary-ink">
            {isCheckedIn ? 'Live session' : 'Standby'}
          </span>
        </div>

        <AttendanceCaptureModal
          isOpen={captureOpen}
          mode={captureMode}
          isSubmitting={busy}
          onClose={() => setCaptureOpen(false)}
          onConfirm={handleConfirmCapture}
        />
      </div>
    );
  }

  const handleOpenDetails = () => {
    if (onNavigate) {
      onNavigate(attendanceRoute);
    } else if (typeof window !== 'undefined') {
      window.history.pushState({}, '', attendanceRoute);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  return (
    <div className={`${cardSurfaceClass} ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-text">Time tracker</span>
          <button
            type="button"
            onClick={handleOpenDetails}
            className="w-7 h-7 rounded-full flex items-center justify-center transition-all hover:scale-110 shadow-xs shrink-0 bg-surface-muted text-text border border-border"
            aria-label="View time tracker details"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
        </div>
        <div className="flex items-baseline gap-2 flex-wrap">
          <p className="text-2xl sm:text-[26px] font-bold font-display leading-none whitespace-nowrap text-text">
            {checkInTime}
          </p>
          <p
            className={`text-xs inline-flex items-center gap-1.5 whitespace-nowrap ${
              isCheckedIn ? 'text-primary-ink' : 'text-text-muted'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isCheckedIn ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'
              }`}
            />
            {isCheckedIn ? 'Checked In' : 'Checked Out'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center">{timerRing('w-28 h-28', 'text-2xl')}</div>

      {actionControls('justify-center')}

      <AttendanceCaptureModal
        isOpen={captureOpen}
        mode={captureMode}
        isSubmitting={busy}
        onClose={() => setCaptureOpen(false)}
        onConfirm={handleConfirmCapture}
      />
    </div>
  );
}
