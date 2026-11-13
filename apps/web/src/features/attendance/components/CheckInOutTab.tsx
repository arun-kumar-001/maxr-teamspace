import { useMemo, useState } from 'react';
import type { AttendanceRecord } from '../types';

export interface CheckInOutTabProps {
  employeeName?: string;
  designation?: string;
  records: AttendanceRecord[];
  onSessionChange?: () => void;
  onViewAllHistory?: () => void;
}

function formatClock(iso: string | null | undefined): string {
  if (!iso) return '\u2014';
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return iso;
  }
}

function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || minutes <= 0) return '\u2014';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function formatRecordDate(workDate: string): string {
  const parts = workDate.split('-').map(Number);
  const d = new Date(parts[0] || 2026, (parts[1] || 1) - 1, parts[2] || 1);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function CircularAttendanceRing({ percentage }: { percentage: number }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;

  return (
    <svg width="38" height="38" viewBox="0 0 38 38" className="shrink-0" aria-hidden="true">
      <circle
        cx="19"
        cy="19"
        r={radius}
        fill="none"
        stroke="rgb(229, 231, 235)"
        strokeWidth="4.5"
      />
      <circle
        cx="19"
        cy="19"
        r={radius}
        fill="none"
        stroke="rgb(85, 205, 179)"
        strokeWidth="4.5"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        transform="rotate(-90 19 19)"
      />
    </svg>
  );
}

function StatusPillBadge({ status }: { status: AttendanceRecord['status'] }) {
  const config: Record<
    AttendanceRecord['status'],
    { bg: string; text: string; dot: string; label: string }
  > = {
    present: {
      bg: 'rgb(220, 252, 231)',
      text: 'rgb(21, 128, 61)',
      dot: 'rgb(22, 163, 74)',
      label: 'Present',
    },
    late: {
      bg: 'rgb(254, 243, 199)',
      text: 'rgb(180, 83, 9)',
      dot: 'rgb(217, 119, 6)',
      label: 'Late',
    },
    absent: {
      bg: 'rgb(254, 226, 226)',
      text: 'rgb(185, 28, 28)',
      dot: 'rgb(220, 38, 38)',
      label: 'Absent',
    },
    half_day: {
      bg: 'rgb(219, 234, 254)',
      text: 'rgb(29, 78, 216)',
      dot: 'rgb(37, 99, 235)',
      label: 'Half Day',
    },
    on_leave: {
      bg: 'rgb(243, 232, 255)',
      text: 'rgb(126, 34, 206)',
      dot: 'rgb(147, 51, 234)',
      label: 'Leave',
    },
    holiday: {
      bg: 'rgb(243, 244, 246)',
      text: 'rgb(75, 85, 99)',
      dot: 'rgb(107, 114, 128)',
      label: 'Holiday',
    },
    weekend: {
      bg: 'rgb(243, 244, 246)',
      text: 'rgb(75, 85, 99)',
      dot: 'rgb(107, 114, 128)',
      label: 'Weekly Off',
    },
  };

  const style = config[status] ?? config.present;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: style.bg, color: style.text }}
    >
      {status === 'absent' ? (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: style.dot }}
        >
          <svg
            className="w-2.5 h-2.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </span>
      ) : status === 'late' || status === 'half_day' ? (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center shrink-0"
          style={{ color: style.dot }}
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" strokeLinecap="round" />
          </svg>
        </span>
      ) : (
        <span
          className="w-4 h-4 rounded-full inline-flex items-center justify-center text-white shrink-0"
          style={{ backgroundColor: style.dot }}
        >
          <svg
            className="w-2.5 h-2.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          >
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
      {style.label}
    </span>
  );
}

const DEV_PREVIEW_HISTORY: AttendanceRecord[] = [
  {
    id: 'preview-1',
    employeeId: 'dev',
    workDate: '2026-11-12',
    checkInTime: '2026-11-12T09:03:00',
    checkOutTime: '2026-11-12T18:01:00',
    durationMinutes: 538,
    breakMinutes: 60,
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-12T09:03:00',
    updatedAt: '2026-11-12T18:01:00',
  },
  {
    id: 'preview-2',
    employeeId: 'dev',
    workDate: '2026-11-11',
    checkInTime: '2026-11-11T09:02:00',
    checkOutTime: '2026-11-11T18:00:00',
    durationMinutes: 538,
    breakMinutes: 60,
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-11T09:02:00',
    updatedAt: '2026-11-11T18:00:00',
  },
  {
    id: 'preview-3',
    employeeId: 'dev',
    workDate: '2026-11-10',
    checkInTime: '2026-11-10T09:28:00',
    checkOutTime: '2026-11-10T18:05:00',
    durationMinutes: 517,
    breakMinutes: 60,
    status: 'late',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-10T09:28:00',
    updatedAt: '2026-11-10T18:05:00',
  },
  {
    id: 'preview-4',
    employeeId: 'dev',
    workDate: '2026-11-09',
    checkInTime: '2026-11-09T09:01:00',
    checkOutTime: '2026-11-09T18:00:00',
    durationMinutes: 539,
    breakMinutes: 60,
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-09T09:01:00',
    updatedAt: '2026-11-09T18:00:00',
  },
  {
    id: 'preview-5',
    employeeId: 'dev',
    workDate: '2026-11-06',
    checkInTime: '2026-11-06T09:04:00',
    checkOutTime: '2026-11-06T18:02:00',
    durationMinutes: 538,
    breakMinutes: 60,
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-06T09:04:00',
    updatedAt: '2026-11-06T18:02:00',
  },
  {
    id: 'preview-6',
    employeeId: 'dev',
    workDate: '2026-11-05',
    checkInTime: '2026-11-05T09:06:00',
    checkOutTime: '2026-11-05T18:03:00',
    durationMinutes: 537,
    breakMinutes: 60,
    status: 'present',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-05T09:06:00',
    updatedAt: '2026-11-05T18:03:00',
  },
  {
    id: 'preview-7',
    employeeId: 'dev',
    workDate: '2026-11-04',
    checkInTime: '2026-11-04T09:31:00',
    checkOutTime: '2026-11-04T18:10:00',
    durationMinutes: 519,
    breakMinutes: 60,
    status: 'late',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-04T09:31:00',
    updatedAt: '2026-11-04T18:10:00',
  },
  {
    id: 'preview-8',
    employeeId: 'dev',
    workDate: '2026-11-03',
    checkInTime: '',
    checkOutTime: null,
    durationMinutes: null,
    breakMinutes: 0,
    status: 'absent',
    location: { workMode: 'office' },
    notes: null,
    createdAt: '2026-11-03T00:00:00',
    updatedAt: '2026-11-03T00:00:00',
  },
];

export function CheckInOutTab({ records, onViewAllHistory }: CheckInOutTabProps) {
  const [dateSearch, setDateSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const effectiveRecords = useMemo(() => {
    if (records.length > 0) return records;
    if (import.meta.env.DEV && import.meta.env.VITE_DEV_MOCK_AUTH !== 'false') {
      return DEV_PREVIEW_HISTORY;
    }
    return records;
  }, [records]);

  const filteredHistoryRecords = useMemo(() => {
    const query = dateSearch.trim().toLowerCase();
    if (!query) return effectiveRecords;
    return effectiveRecords.filter((rec) => {
      const formatted = formatRecordDate(rec.workDate).toLowerCase();
      return rec.workDate.toLowerCase().includes(query) || formatted.includes(query);
    });
  }, [effectiveRecords, dateSearch]);

  const recentRecords = useMemo(() => effectiveRecords.slice(0, 4), [effectiveRecords]);

  const monthOptions = useMemo(() => {
    const base = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      return {
        value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      };
    });
  }, []);

  const monthlyStats = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const year = Number(yStr) || new Date().getFullYear();
    const monthIdx = (Number(mStr) || 1) - 1;
    const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

    let workingDays = 0;
    for (let day = 1; day <= daysInMonth; day += 1) {
      const dow = new Date(year, monthIdx, day).getDay();
      if (dow !== 0 && dow !== 6) workingDays += 1;
    }

    let present = 0;
    let absent = 0;
    let late = 0;
    let leave = 0;
    for (const r of effectiveRecords) {
      if (!r.workDate.startsWith(selectedMonth)) continue;
      if (r.status === 'absent') absent += 1;
      else if (r.status === 'on_leave') leave += 1;
      else {
        present += 1;
        if (r.status === 'late') late += 1;
      }
    }

    const pct = workingDays > 0 ? Math.min(100, (present / workingDays) * 100) : 0;
    return { workingDays, present, absent, late, leave, pct };
  }, [effectiveRecords, selectedMonth]);

  return (
    <div className="space-y-4" data-testid="check-in-tab-panel">
      {/* 1. Bottom Split: Recent Attendance + Monthly Attendance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Attendance Table */}
        <div
          className="p-5 rounded-2xl border bg-white space-y-3"
          style={{
            borderColor: 'rgb(229, 231, 235)',
            boxShadow: '0 2px 10px rgba(8, 11, 12, 0.03)',
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              Recent Attendance
            </h3>
            {onViewAllHistory && (
              <button
                type="button"
                onClick={onViewAllHistory}
                className="text-xs font-semibold hover:underline cursor-pointer"
                style={{ color: 'rgb(13, 148, 136)' }}
              >
                View All
              </button>
            )}
          </div>

          {recentRecords.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">
              No recent attendance records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr
                    className="border-b text-gray-500"
                    style={{ borderColor: 'rgb(229, 231, 235)' }}
                  >
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 px-2 font-medium">Check-in</th>
                    <th className="py-2 px-2 font-medium">Check-out</th>
                    <th className="py-2 px-2 font-medium">Working Hours</th>
                    <th className="py-2 pl-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'rgb(243, 244, 246)' }}>
                  {recentRecords.map((rec) => (
                    <tr key={rec.id}>
                      <td
                        className="py-2.5 pr-3 font-semibold whitespace-nowrap"
                        style={{ color: 'rgb(8, 11, 12)' }}
                      >
                        {formatRecordDate(rec.workDate)}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">
                        {formatClock(rec.checkInTime)}
                      </td>
                      <td className="py-2.5 px-2 text-gray-700 whitespace-nowrap">
                        {formatClock(rec.checkOutTime)}
                      </td>
                      <td className="py-2.5 px-2 font-medium text-gray-800 whitespace-nowrap">
                        {formatDuration(rec.durationMinutes)}
                      </td>
                      <td className="py-2.5 pl-2 whitespace-nowrap">
                        <StatusPillBadge status={rec.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Monthly Attendance Summary */}
        <div
          className="p-5 rounded-2xl border bg-white space-y-3"
          style={{
            borderColor: 'rgb(229, 231, 235)',
            boxShadow: '0 2px 10px rgba(8, 11, 12, 0.03)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              Monthly Attendance
            </h3>
            <select
              aria-label="Select month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-white text-gray-800"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <span
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center bg-white border shrink-0"
                style={{ borderColor: 'rgb(229, 231, 235)', color: 'rgb(8, 11, 12)' }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Working Days</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.workingDays}
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <span
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgb(220, 252, 231)', color: 'rgb(22, 163, 74)' }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Present</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.present}
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <span
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgb(254, 226, 226)', color: 'rgb(220, 38, 38)' }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                >
                  <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Absent</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.absent}
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <span
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgb(254, 243, 199)', color: 'rgb(217, 119, 6)' }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v5l3 2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Late Arrivals</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.late}
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <span
                className="w-8 h-8 rounded-lg inline-flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgb(243, 232, 255)', color: 'rgb(147, 51, 234)' }}
              >
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div>
                <p className="text-[11px] text-gray-500">Leave Days</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.leave}
                </p>
              </div>
            </div>

            <div
              className="p-3 rounded-xl border flex items-center gap-2.5"
              style={{ backgroundColor: 'rgb(244, 247, 246)', borderColor: 'rgb(229, 231, 235)' }}
            >
              <CircularAttendanceRing percentage={monthlyStats.pct} />
              <div>
                <p className="text-[11px] text-gray-500">Attendance</p>
                <p className="text-base font-bold tabular-nums" style={{ color: 'rgb(8, 11, 12)' }}>
                  {monthlyStats.pct.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Full-Width Attendance History Table */}
      <div
        className="p-5 rounded-2xl border bg-white space-y-4"
        style={{
          borderColor: 'rgb(229, 231, 235)',
          boxShadow: '0 2px 10px rgba(8, 11, 12, 0.03)',
        }}
        data-testid="attendance-history-card"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-800 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <h3 className="text-base font-bold font-display" style={{ color: 'rgb(8, 11, 12)' }}>
              Attendance History
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <svg
              className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={dateSearch}
              onChange={(e) => setDateSearch(e.target.value)}
              placeholder="Search by date..."
              aria-label="Search attendance history by date"
              className="w-full pl-9 pr-3 py-2 rounded-xl border text-xs text-gray-800 bg-white focus:outline-none focus:ring-2 focus:ring-primary-strong"
              style={{ borderColor: 'rgb(229, 231, 235)' }}
              data-testid="attendance-history-search"
            />
          </div>
        </div>

        {filteredHistoryRecords.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">
            {dateSearch.trim()
              ? 'No attendance records match that date.'
              : 'No attendance history records found.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr
                  style={{
                    backgroundColor: 'rgb(236, 253, 245)',
                    color: 'rgb(8, 11, 12)',
                  }}
                >
                  <th className="py-3 px-4 font-semibold rounded-l-xl">Date</th>
                  <th className="py-3 px-3 font-semibold">Check-In</th>
                  <th className="py-3 px-3 font-semibold">Check-Out</th>
                  <th className="py-3 px-3 font-semibold">Working Hours</th>
                  <th className="py-3 px-3 font-semibold">Break Duration</th>
                  <th className="py-3 px-4 font-semibold rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'rgb(243, 244, 246)' }}>
                {filteredHistoryRecords.map((rec) => (
                  <tr key={`hist-${rec.id}`} className="hover:bg-gray-50/70 transition-colors">
                    <td
                      className="py-3 px-4 font-medium whitespace-nowrap"
                      style={{ color: 'rgb(8, 11, 12)' }}
                    >
                      {formatRecordDate(rec.workDate)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap tabular-nums">
                      {formatClock(rec.checkInTime)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap tabular-nums">
                      {formatClock(rec.checkOutTime)}
                    </td>
                    <td
                      className="py-3 px-3 font-medium whitespace-nowrap tabular-nums"
                      style={{ color: 'rgb(8, 11, 12)' }}
                    >
                      {formatDuration(rec.durationMinutes)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap tabular-nums">
                      {formatDuration(rec.breakMinutes)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <StatusPillBadge status={rec.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
