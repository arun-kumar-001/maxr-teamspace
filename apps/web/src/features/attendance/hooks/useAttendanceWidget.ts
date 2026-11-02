import { useCallback, useEffect, useState } from 'react';
import {
  checkIn as apiCheckIn,
  checkOut as apiCheckOut,
  fetchTodayAttendance,
} from '../api/attendance';
import type {
  AttendanceRecord,
  CheckInRequest,
  CheckOutRequest,
  TodayAttendanceSummary,
  WorkMode,
} from '../types';

export interface UseAttendanceWidgetResult {
  summary: TodayAttendanceSummary | null;
  activeSession: AttendanceRecord | null;
  isCheckedIn: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  elapsedTimeString: string;
  workMode: WorkMode;
  setWorkMode: (mode: WorkMode) => void;
  notes: string;
  setNotes: (notes: string) => void;
  checkIn: () => Promise<boolean>;
  checkOut: () => Promise<boolean>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

function calculateElapsed(checkInIso: string): string {
  const startTime = new Date(checkInIso).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - startTime);
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
}

export function useAttendanceWidget(): UseAttendanceWidgetResult {
  const [summary, setSummary] = useState<TodayAttendanceSummary | null>(null);
  const [activeSession, setActiveSession] = useState<AttendanceRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workMode, setWorkMode] = useState<WorkMode>('office');
  const [notes, setNotes] = useState('');
  const [elapsedTimeString, setElapsedTimeString] = useState('');

  const refresh = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await fetchTodayAttendance();
      setSummary(data);
      setActiveSession(data.activeSession);
      if (data.activeSession?.location?.workMode) {
        setWorkMode(data.activeSession.location.workMode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load attendance session';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Update elapsed time every 30 seconds if there is an active session
  useEffect(() => {
    if (!activeSession) {
      setElapsedTimeString('');
      return;
    }

    setElapsedTimeString(calculateElapsed(activeSession.checkInTime));
    const interval = setInterval(() => {
      setElapsedTimeString(calculateElapsed(activeSession.checkInTime));
    }, 30000);

    return () => clearInterval(interval);
  }, [activeSession]);

  const handleCheckIn = useCallback(async (): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setError(null);
      const req: CheckInRequest = {
        location: { workMode },
        notes: notes.trim() ? notes.trim() : undefined,
      };
      const record = await apiCheckIn(req);
      setActiveSession(record);
      setNotes('');
      await refresh();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-in failed';
      setError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [workMode, notes, refresh]);

  const handleCheckOut = useCallback(async (): Promise<boolean> => {
    try {
      setIsSubmitting(true);
      setError(null);
      const req: CheckOutRequest = {
        notes: notes.trim() ? notes.trim() : undefined,
      };
      await apiCheckOut(req);
      setActiveSession(null);
      setNotes('');
      await refresh();
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Check-out failed';
      setError(msg);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [notes, refresh]);

  return {
    summary,
    activeSession,
    isCheckedIn: Boolean(activeSession),
    isLoading,
    isSubmitting,
    error,
    elapsedTimeString,
    workMode,
    setWorkMode,
    notes,
    setNotes,
    checkIn: handleCheckIn,
    checkOut: handleCheckOut,
    refresh,
    clearError: () => setError(null),
  };
}
