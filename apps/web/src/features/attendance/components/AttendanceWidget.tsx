import { useState } from 'react';
import { Button } from '../../../components/ui';
import { useAttendanceWidget } from '../hooks/useAttendanceWidget';

export interface AttendanceWidgetProps {
  className?: string;
  onSessionChange?: () => void;
}

function formatUtcTime(isoString: string): string {
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

export function AttendanceWidget({ className = '', onSessionChange }: AttendanceWidgetProps) {
  const {
    summary,
    activeSession,
    isCheckedIn,
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
    clearError,
  } = useAttendanceWidget();

  const [showNotesInput, setShowNotesInput] = useState(false);

  const handleAction = async () => {
    let success = false;
    if (isCheckedIn) {
      success = await checkOut();
    } else {
      success = await checkIn();
    }
    if (success && onSessionChange) {
      onSessionChange();
    }
  };

  const checkInTimeFormatted = activeSession ? formatUtcTime(activeSession.checkInTime) : null;
  const totalCompletedMinutes = summary?.totalDurationMinutes ?? 0;

  return (
    <div
      className={`p-6 bg-surface border border-border rounded-card shadow-card space-y-4 ${className}`}
      data-testid="attendance-widget"
    >
      {error && (
        <div
          className="p-3 bg-negative-soft border border-negative-ink/20 rounded-md text-xs sm:text-sm text-negative-ink flex items-center justify-between gap-2"
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

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                isCheckedIn
                  ? 'bg-positive-ink animate-pulse ring-4 ring-positive-soft'
                  : 'bg-text-subtle'
              }`}
              aria-hidden="true"
            />
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Today&apos;s Attendance Session
            </span>
            {isCheckedIn && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-positive-soft text-positive-ink border border-positive-ink/20">
                Active
              </span>
            )}
          </div>

          <p className="text-lg sm:text-xl font-bold text-text font-display">
            {isLoading
              ? 'Loading attendance status...'
              : isCheckedIn
                ? `Checked In \u00B7 Started at ${checkInTimeFormatted}${elapsedTimeString ? ` (${elapsedTimeString})` : ''}`
                : totalCompletedMinutes > 0
                  ? `Completed ${formatDurationMinutes(totalCompletedMinutes)} today`
                  : 'Not Checked In \u00B7 Shift Pending'}
          </p>

          <p className="text-xs text-text-muted">
            Regular Shift: 09:00 AM &ndash; 06:00 PM (IST) &middot; Mode:{' '}
            <span className="font-semibold capitalize text-text">
              {activeSession?.location?.workMode ?? workMode}
            </span>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {!isCheckedIn && !isLoading && (
            <div className="flex rounded-md p-0.5 bg-surface-muted border border-border">
              <button
                type="button"
                onClick={() => setWorkMode('office')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                  workMode === 'office'
                    ? 'bg-surface text-primary-deep shadow-sm font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
                data-testid="mode-office-btn"
              >
                Office
              </button>
              <button
                type="button"
                onClick={() => setWorkMode('remote')}
                className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold rounded min-h-[44px] transition-colors ${
                  workMode === 'remote'
                    ? 'bg-surface text-primary-deep shadow-sm font-bold'
                    : 'text-text-muted hover:text-text'
                }`}
                data-testid="mode-remote-btn"
              >
                Remote
              </button>
            </div>
          )}

          <Button
            variant={isCheckedIn ? 'danger' : 'primary'}
            size="lg"
            onClick={handleAction}
            isLoading={isSubmitting || isLoading}
            className="w-full sm:w-auto min-h-[48px] px-6 text-sm font-bold shadow-sm"
            data-testid="attendance-toggle-button"
          >
            {isCheckedIn ? 'Check Out for Today' : 'Check In Now'}
          </Button>
        </div>
      </div>

      {/* Optional Note field toggle */}
      {!isCheckedIn && !isLoading && (
        <div className="pt-2 border-t border-border">
          {!showNotesInput ? (
            <button
              type="button"
              onClick={() => setShowNotesInput(true)}
              className="text-xs text-primary-deep hover:underline min-h-[44px] inline-flex items-center font-medium"
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
                className="w-full text-xs sm:text-sm px-3 py-2 bg-surface border border-border rounded-md text-text placeholder-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-strong min-h-[44px]"
                data-testid="attendance-notes-input"
              />
              <button
                type="button"
                onClick={() => {
                  setNotes('');
                  setShowNotesInput(false);
                }}
                className="text-xs text-text-muted hover:text-text px-2 py-1 min-h-[44px] inline-flex items-center shrink-0"
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
