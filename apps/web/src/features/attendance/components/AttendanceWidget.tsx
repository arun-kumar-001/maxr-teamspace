import { useEffect, useState } from 'react';
import { Button } from '../../../components/ui';
import { useAttendanceWidget } from '../hooks/useAttendanceWidget';
import type { AttendanceBreak } from '../types';

export interface AttendanceWidgetProps {
  className?: string;
  onSessionChange?: () => void;
  theme?: 'light' | 'dark';
  employeeName?: string;
  designation?: string;
}

function formatUtcTime(isoString: string | null | undefined): string {
  if (!isoString) return '--:--';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatDurationMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function AttendanceWidget({
  className = '',
  onSessionChange,
  theme = 'light',
  employeeName,
  designation,
}: AttendanceWidgetProps) {
  const {
    summary,
    activeSession,
    isCheckedIn,
    isOnBreak,
    breakMinutes,
    isLoading,
    isSubmitting,
    error,
    elapsedTimeString,
    workMode,
    setWorkMode,
    notes,
    setNotes,
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    clearError,
  } = useAttendanceWidget();

  const [showNotesInput, setShowNotesInput] = useState(false);
  const [confirmationMsg, setConfirmationMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isDark = theme === 'dark';

  const handleAction = async () => {
    setConfirmationMsg(null);
    let success = false;
    if (isCheckedIn) {
      success = await checkOut();
      if (success) setConfirmationMsg('Checked out for today. Great work!');
    } else {
      success = await checkIn();
      if (success) setConfirmationMsg('Checked in successfully. Have a productive shift!');
    }
    if (success && onSessionChange) {
      onSessionChange();
    }
  };

  const handleBreakToggle = async () => {
    setConfirmationMsg(null);
    let success = false;
    if (isOnBreak) {
      success = await endBreak();
      if (success) setConfirmationMsg('Break ended. Work timer resumed.');
    } else {
      success = await startBreak();
      if (success) setConfirmationMsg('Break started. Take a breather!');
    }
    if (success && onSessionChange) {
      onSessionChange();
    }
  };

  const checkInTimeFormatted = activeSession ? formatUtcTime(activeSession.checkInTime) : null;
  const totalCompletedMinutes = summary?.totalDurationMinutes ?? 0;
  const breaksList: AttendanceBreak[] = activeSession?.breaks ?? [];
  const totalSummaryBreakMinutes = (summary?.sessions ?? []).reduce(
    (sum, s) => sum + (s.breakMinutes ?? 0),
    0,
  );
  const timelineSessions = summary?.sessions?.length
    ? summary.sessions
    : activeSession
      ? [activeSession]
      : [];

  const cardStyle = isDark
    ? {
        background:
          'linear-gradient(145deg, rgba(17, 24, 25, 0.92), rgba(24, 34, 36, 0.86) 55%, rgba(73, 53, 72, 0.45))',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderColor: 'rgba(85, 205, 179, 0.25)',
        boxShadow: '0 18px 42px rgba(8, 11, 12, 0.48), inset 0 1px 0 rgba(244, 247, 246, 0.08)',
        borderRadius: '20px',
        color: 'rgb(244, 247, 246)',
      }
    : {
        backgroundColor: 'rgba(255, 255, 255, 0.68)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderColor: 'rgba(255, 255, 255, 0.65)',
        boxShadow: '0 10px 32px rgba(85, 205, 179, 0.06), 0 2px 6px rgba(8, 11, 12, 0.03)',
        borderRadius: '16px',
      };

  const primaryTextClass = isDark ? 'text-white' : 'text-text';
  const mutedTextStyle = isDark ? { color: 'rgba(244, 247, 246, 0.7)' } : undefined;
  const mutedTextClass = isDark ? '' : 'text-text-muted';

  return (
    <div
      className={`p-4 sm:p-6 border shadow-card space-y-4 ${
        isDark ? '' : 'bg-surface border-border rounded-[16px]'
      } ${className}`}
      style={cardStyle}
      data-testid="attendance-widget"
    >
      {error && (
        <div
          className="p-2.5 bg-negative-soft border border-negative-ink/20 rounded-md text-xs sm:text-sm text-negative-ink flex items-center justify-between gap-2"
          role="alert"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="text-negative-ink font-bold hover:underline min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2"
            aria-label="Dismiss error"
          >
            &times;
          </button>
        </div>
      )}

      {confirmationMsg && !error && (
        <div
          className="p-2.5 rounded-lg text-xs sm:text-sm flex items-center justify-between gap-2 border"
          style={
            isDark
              ? {
                  backgroundColor: 'rgba(85, 205, 179, 0.14)',
                  borderColor: 'rgba(0, 220, 203, 0.35)',
                  color: 'rgb(0, 220, 203)',
                }
              : {
                  backgroundColor: 'rgb(233, 248, 246)',
                  borderColor: 'rgba(13, 148, 136, 0.25)',
                  color: 'rgb(15, 118, 110)',
                }
          }
          role="status"
          data-testid="attendance-confirmation-banner"
        >
          <span>{confirmationMsg}</span>
          <button
            type="button"
            onClick={() => setConfirmationMsg(null)}
            className="font-bold hover:underline min-h-[32px] px-2"
            aria-label="Dismiss confirmation"
          >
            &times;
          </button>
        </div>
      )}

      {isDark && (
        <div
          className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
          style={{ borderColor: 'rgba(244, 247, 246, 0.1)' }}
        >
          <div>
            {employeeName && (
              <p className="text-sm font-semibold" style={{ color: 'rgb(244, 247, 246)' }}>
                {employeeName}
                {designation ? (
                  <span
                    className="ml-2 text-xs font-normal"
                    style={{ color: 'rgba(244, 247, 246, 0.65)' }}
                  >
                    &middot; {designation}
                  </span>
                ) : null}
              </p>
            )}
            <p className="text-xs" style={{ color: 'rgba(244, 247, 246, 0.68)' }}>
              {now.toLocaleDateString(undefined, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="text-right">
            <p
              className="text-xl sm:text-2xl font-bold font-display tabular-nums tracking-tight"
              style={{ color: 'rgb(0, 220, 203)' }}
              data-testid="attendance-live-clock"
            >
              {now.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
            <p className="text-[11px]" style={{ color: 'rgba(244, 247, 246, 0.6)' }}>
              Live Local Time
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                isCheckedIn
                  ? isOnBreak
                    ? 'animate-pulse'
                    : 'bg-positive-ink animate-pulse ring-4 ring-positive-soft'
                  : 'bg-text-subtle'
              }`}
              style={
                isCheckedIn && isOnBreak
                  ? { backgroundColor: 'rgb(233, 138, 203)' }
                  : isDark && isCheckedIn
                    ? { backgroundColor: 'rgb(0, 220, 203)' }
                    : undefined
              }
              aria-hidden="true"
            />
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${mutedTextClass}`}
              style={mutedTextStyle}
            >
              Today&apos;s Attendance Session
            </span>
            {isCheckedIn && (
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  isDark ? '' : 'bg-positive-soft text-positive-ink border-positive-ink/20'
                }`}
                style={
                  isDark
                    ? {
                        backgroundColor: 'rgba(85, 205, 179, 0.18)',
                        color: 'rgb(85, 205, 179)',
                        borderColor: 'rgba(85, 205, 179, 0.35)',
                      }
                    : undefined
                }
              >
                Active
              </span>
            )}
            {isCheckedIn && isOnBreak && (
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: 'rgba(233, 138, 203, 0.16)',
                  color: 'rgb(233, 138, 203)',
                  borderColor: 'rgba(233, 138, 203, 0.4)',
                }}
                data-testid="attendance-on-break-pill"
              >
                On Break
              </span>
            )}
          </div>

          <p className={`text-base sm:text-lg font-bold font-display ${primaryTextClass}`}>
            {isLoading
              ? 'Loading attendance status...'
              : isCheckedIn
                ? `Checked In \u00B7 Started at ${checkInTimeFormatted}${elapsedTimeString ? ` (${elapsedTimeString})` : ''}`
                : totalCompletedMinutes > 0
                  ? `Completed ${formatDurationMinutes(totalCompletedMinutes)} today`
                  : 'Not Checked In \u00B7 Shift Pending'}
          </p>

          <p className={`text-xs ${mutedTextClass}`} style={mutedTextStyle}>
            Regular Shift: 09:00 AM &ndash; 06:00 PM (IST) &middot; Mode:{' '}
            <span
              className={`font-semibold capitalize ${primaryTextClass}`}
              style={isDark ? { color: 'rgb(85, 205, 179)' } : undefined}
            >
              {activeSession?.location?.workMode ?? workMode}
            </span>
            {(breakMinutes > 0 || totalSummaryBreakMinutes > 0) && (
              <>
                {' '}
                &middot; Break:{' '}
                <span className="font-semibold">
                  {formatDurationMinutes(breakMinutes || totalSummaryBreakMinutes)}
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5">
          {!isCheckedIn && !isLoading && (
            <div
              className={`flex rounded-md p-0.5 border ${
                isDark ? '' : 'bg-surface-muted border-border'
              }`}
              style={
                isDark
                  ? {
                      backgroundColor: 'rgba(8, 11, 12, 0.55)',
                      borderColor: 'rgba(244, 247, 246, 0.14)',
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onClick={() => setWorkMode('office')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                  !isDark
                    ? workMode === 'office'
                      ? 'bg-surface text-primary-deep shadow-sm font-bold'
                      : 'text-text-muted hover:text-text'
                    : ''
                }`}
                style={
                  isDark
                    ? workMode === 'office'
                      ? {
                          backgroundColor: 'rgb(85, 205, 179)',
                          color: 'rgb(8, 11, 12)',
                          fontWeight: 700,
                        }
                      : { color: 'rgba(244, 247, 246, 0.72)' }
                    : undefined
                }
                data-testid="mode-office-btn"
              >
                Office
              </button>
              <button
                type="button"
                onClick={() => setWorkMode('remote')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                  !isDark
                    ? workMode === 'remote'
                      ? 'bg-surface text-primary-deep shadow-sm font-bold'
                      : 'text-text-muted hover:text-text'
                    : ''
                }`}
                style={
                  isDark
                    ? workMode === 'remote'
                      ? {
                          backgroundColor: 'rgb(85, 205, 179)',
                          color: 'rgb(8, 11, 12)',
                          fontWeight: 700,
                        }
                      : { color: 'rgba(244, 247, 246, 0.72)' }
                    : undefined
                }
                data-testid="mode-remote-btn"
              >
                Remote
              </button>
            </div>
          )}

          {isCheckedIn && !isLoading && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleBreakToggle}
              isLoading={isSubmitting}
              className="w-full sm:w-auto min-h-[44px] px-4 text-sm font-semibold"
              style={
                isDark
                  ? {
                      borderColor: isOnBreak
                        ? 'rgba(233, 138, 203, 0.55)'
                        : 'rgba(85, 205, 179, 0.45)',
                      color: isOnBreak ? 'rgb(233, 138, 203)' : 'rgb(85, 205, 179)',
                      backgroundColor: 'rgba(8, 11, 12, 0.45)',
                    }
                  : undefined
              }
              data-testid={isOnBreak ? 'attendance-end-break-btn' : 'attendance-start-break-btn'}
            >
              {isOnBreak ? 'End Break' : 'Start Break'}
            </Button>
          )}

          <Button
            variant={isCheckedIn ? 'danger' : 'primary'}
            size="lg"
            onClick={handleAction}
            isLoading={isSubmitting || isLoading}
            className="w-full sm:w-auto min-h-[44px] px-5 text-sm font-bold shadow-sm"
            style={
              isDark && !isCheckedIn
                ? {
                    backgroundColor: 'rgb(85, 205, 179)',
                    color: 'rgb(8, 11, 12)',
                    boxShadow: '0 0 22px rgba(0, 220, 203, 0.28)',
                  }
                : undefined
            }
            data-testid="attendance-toggle-button"
          >
            {isCheckedIn ? 'Check Out for Today' : 'Check In Now'}
          </Button>
        </div>
      </div>

      {/* Daily Attendance Timeline when active or completed */}
      {isDark && timelineSessions.length > 0 && (
        <div
          className="pt-3 border-t space-y-2"
          style={{ borderColor: 'rgba(244, 247, 246, 0.1)' }}
          data-testid="attendance-daily-timeline"
        >
          <p
            className="text-[11px] font-bold uppercase tracking-wider"
            style={{ color: 'rgba(244, 247, 246, 0.6)' }}
          >
            Daily Attendance Timeline
          </p>
          <div className="flex flex-wrap gap-2">
            {timelineSessions.map((rec) => (
              <div key={rec.id} className="contents">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: 'rgba(85, 205, 179, 0.12)',
                    borderColor: 'rgba(85, 205, 179, 0.3)',
                    color: 'rgb(85, 205, 179)',
                  }}
                >
                  In: {formatUtcTime(rec.checkInTime)}
                </span>
                {(rec.breaks ?? breaksList).map((brk, i) => (
                  <span
                    key={`${rec.id}-brk-${i}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{
                      backgroundColor: 'rgba(233, 138, 203, 0.12)',
                      borderColor: 'rgba(233, 138, 203, 0.3)',
                      color: 'rgb(233, 138, 203)',
                    }}
                  >
                    Break {i + 1}: {formatUtcTime(brk.startTime)} &ndash;{' '}
                    {brk.endTime ? formatUtcTime(brk.endTime) : 'Ongoing'}
                  </span>
                ))}
                {rec.checkOutTime && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{
                      backgroundColor: 'rgba(244, 247, 246, 0.08)',
                      borderColor: 'rgba(244, 247, 246, 0.22)',
                      color: 'rgb(244, 247, 246)',
                    }}
                  >
                    Out: {formatUtcTime(rec.checkOutTime)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Optional Note field toggle */}
      {!isCheckedIn && !isLoading && (
        <div
          className={`pt-2 border-t ${isDark ? '' : 'border-border'}`}
          style={isDark ? { borderColor: 'rgba(244, 247, 246, 0.1)' } : undefined}
        >
          {!showNotesInput ? (
            <button
              type="button"
              onClick={() => setShowNotesInput(true)}
              className={`text-xs hover:underline min-h-[44px] inline-flex items-center font-medium ${
                isDark ? '' : 'text-primary-deep'
              }`}
              style={isDark ? { color: 'rgb(85, 205, 179)' } : undefined}
              data-testid="toggle-notes-btn"
            >
              + Add check-in note
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mt-1">
              <input
                type="text"
                placeholder="Optional check-in note (e.g. client visit, traffic delay)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                className={`w-full text-xs sm:text-sm px-3 py-2 border rounded-md focus:outline-none focus:ring-2 min-h-[44px] ${
                  isDark
                    ? 'text-white placeholder:text-slate-400'
                    : 'bg-surface border-border text-text placeholder-text-subtle focus:ring-primary-strong'
                }`}
                style={
                  isDark
                    ? {
                        backgroundColor: 'rgba(8, 11, 12, 0.65)',
                        borderColor: 'rgba(85, 205, 179, 0.3)',
                      }
                    : undefined
                }
                data-testid="attendance-notes-input"
              />
              <button
                type="button"
                onClick={() => {
                  setNotes('');
                  setShowNotesInput(false);
                }}
                className={`text-xs px-2 py-1 min-h-[44px] inline-flex items-center shrink-0 ${
                  isDark ? 'text-slate-300 hover:text-white' : 'text-text-muted hover:text-text'
                }`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
