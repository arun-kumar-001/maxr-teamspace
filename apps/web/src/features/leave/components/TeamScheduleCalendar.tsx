import { useState } from 'react';

export interface CalendarEvent {
  id: string;
  dayIndex: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  title: string;
  startTime: string; // "06:00"
  endTime: string; // "07:30"
  startHour: number; // 6
  durationHours: number; // 1.5
  variant: 'blue' | 'mint' | 'purple' | 'yellow' | 'pink' | 'white';
  avatars?: string[];
  subtitle?: string;
  hasAttachment?: boolean;
  attachmentType?: 'document' | 'image';
}

const INITIAL_EVENTS: CalendarEvent[] = [
  // Sunday (16)
  {
    id: 'ev-1',
    dayIndex: 0,
    title: 'Booking taxi app',
    startTime: '06:00',
    endTime: '07:30',
    startHour: 6,
    durationHours: 1.5,
    variant: 'blue',
    avatars: ['AL', 'JR', 'SC'],
  },
  {
    id: 'ev-2',
    dayIndex: 0,
    title: 'Development meet',
    startTime: '06:00',
    endTime: '08:00',
    startHour: 8,
    durationHours: 1.25,
    variant: 'purple',
  },
  {
    id: 'ev-3',
    dayIndex: 0,
    title: 'Development meet',
    startTime: '08:40',
    endTime: '10:00',
    startHour: 9.35,
    durationHours: 1.3,
    variant: 'white',
  },

  // Monday (17)
  {
    id: 'ev-4',
    dayIndex: 1,
    title: 'Design onboarding',
    startTime: '06:00',
    endTime: '07:10',
    startHour: 6,
    durationHours: 1.2,
    variant: 'mint',
  },
  {
    id: 'ev-5',
    dayIndex: 1,
    title: 'Book offsite',
    startTime: '07:30',
    endTime: '10:00',
    startHour: 7.5,
    durationHours: 2.2,
    variant: 'white',
    avatars: ['EM', 'DA', 'TK'],
    hasAttachment: true,
    attachmentType: 'image',
  },
  {
    id: 'ev-6',
    dayIndex: 1,
    title: 'New project',
    startTime: '10:45',
    endTime: '12:30',
    startHour: 10.75,
    durationHours: 1.75,
    variant: 'blue',
    subtitle: 'Clients Brief',
    hasAttachment: true,
    attachmentType: 'document',
  },

  // Tuesday (18)
  {
    id: 'ev-7',
    dayIndex: 2,
    title: 'Design session',
    startTime: '07:50',
    endTime: '09:30',
    startHour: 7.8,
    durationHours: 1.6,
    variant: 'yellow',
  },
  {
    id: 'ev-8',
    dayIndex: 2,
    title: 'Design Review',
    startTime: '09:40',
    endTime: '10:30',
    startHour: 9.65,
    durationHours: 1.0,
    variant: 'blue',
  },
  {
    id: 'ev-9',
    dayIndex: 2,
    title: 'Unboarding meet',
    startTime: '10:50',
    endTime: '12:00',
    startHour: 10.8,
    durationHours: 1.35,
    variant: 'pink',
    avatars: ['LP', 'MR'],
  },

  // Wednesday (19)
  {
    id: 'ev-10',
    dayIndex: 3,
    title: 'Meet',
    startTime: '08:00',
    endTime: '09:10',
    startHour: 7.3,
    durationHours: 1.5,
    variant: 'mint',
  },
  {
    id: 'ev-11',
    dayIndex: 3,
    title: 'Review',
    startTime: '07:00',
    endTime: '07:30',
    startHour: 9.0,
    durationHours: 1.5,
    variant: 'purple',
  },
  {
    id: 'ev-12',
    dayIndex: 3,
    title: 'Review',
    startTime: '12:00',
    endTime: '12:30',
    startHour: 11.2,
    durationHours: 1.3,
    variant: 'yellow',
    avatars: ['AL', 'RK'],
  },

  // Thursday (20)
  {
    id: 'ev-13',
    dayIndex: 4,
    title: 'Planning tasks',
    startTime: '07:50',
    endTime: '08:30',
    startHour: 6.8,
    durationHours: 1.0,
    variant: 'white',
  },
  {
    id: 'ev-14',
    dayIndex: 4,
    title: 'Design our website',
    startTime: '08:30',
    endTime: '10:50',
    startHour: 8.0,
    durationHours: 2.3,
    variant: 'pink',
    hasAttachment: true,
    attachmentType: 'image',
  },
];

const DAYS_HEADER = [
  { name: 'Sunday', date: 16, dayIndex: 0 },
  { name: 'Monday', date: 17, dayIndex: 1 },
  { name: 'Tuesday', date: 18, dayIndex: 2 },
  { name: 'Wednesday', date: 19, dayIndex: 3 },
  { name: 'Thursday', date: 20, dayIndex: 4 },
  { name: 'Friday', date: 21, dayIndex: 5 },
  { name: 'Saturday', date: 22, dayIndex: 6 },
];

const TIME_ROWS = [
  { label: '6 am', hour: 6 },
  { label: '7 am', hour: 7 },
  { label: '8 am', hour: 8 },
  { label: '9 am', hour: 9 },
  { label: '10 am', hour: 10 },
  { label: '11 am', hour: 11 },
  { label: '12 am', hour: 12 },
  { label: '1 pm', hour: 13 },
];

export function TeamScheduleCalendar() {
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
  const [activeDayIndex, setActiveDayIndex] = useState<number>(1); // Monday default (Image 1)
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [showEventModal, setShowEventModal] = useState<boolean>(true);
  const [eventTitle, setEventTitle] = useState('Meet with Jonson Rider');
  const [eventDate, setEventDate] = useState('Tuesday, 18 December');
  const [startTime, setStartTime] = useState('06:00');
  const [endTime, setEndTime] = useState('07:00');
  const [location, setLocation] = useState('Park Lane Office');
  const [activeTag, setActiveTag] = useState<'Design' | 'Personal' | 'Developer'>('Design');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Styling helper for events
  const getEventStyle = (variant: CalendarEvent['variant']) => {
    switch (variant) {
      case 'blue':
        return 'bg-blue-100/90 text-blue-950 border border-blue-200 hover:bg-blue-200/80';
      case 'mint':
        return 'bg-emerald-100/90 text-emerald-950 border border-emerald-200 hover:bg-emerald-200/80';
      case 'purple':
        return 'bg-purple-100/90 text-purple-950 border border-purple-200 hover:bg-purple-200/80';
      case 'yellow':
        return 'bg-amber-100/90 text-amber-950 border border-amber-200 hover:bg-amber-200/80';
      case 'pink':
        return 'bg-pink-100/90 text-pink-950 border border-pink-200 hover:bg-pink-200/80';
      case 'white':
      default:
        return 'bg-surface text-text border border-border shadow-sm hover:border-primary-strong';
    }
  };

  const handleAddEvent = () => {
    const newEv: CalendarEvent = {
      id: `ev-${Date.now()}`,
      dayIndex: 2, // Tuesday slot
      title: eventTitle || 'New Event',
      startTime,
      endTime,
      startHour: 6,
      durationHours: 1,
      variant: 'mint',
      avatars: ['JR', 'ME'],
    };
    setEvents((prev) => [...prev, newEv]);
    setShowEventModal(false);
  };

  return (
    <div
      className="bg-surface rounded-card border border-border shadow-card p-4 sm:p-6 lg:p-7 relative overflow-hidden"
      data-testid="team-schedule-calendar"
    >
      {/* 1. TOP HEADER ROW */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border/70">
        {/* Title: December, 2023 */}
        <div className="flex items-center gap-3">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
            December, 2023
          </h2>
        </div>

        {/* Center: Month / Week / Day pills */}
        <div className="flex items-center bg-surface-muted p-1 rounded-full border border-border self-start md:self-auto">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all ${
                viewMode === mode
                  ? 'bg-text text-white shadow-sm'
                  : 'text-text-muted hover:text-text'
              }`}
              data-testid={`calendar-view-${mode}`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Right: Date navigation buttons */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setCurrentWeekOffset((prev) => prev - 1)}
            aria-label="Previous week"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-muted transition-colors shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => setCurrentWeekOffset(0)}
            className="px-3.5 py-1.5 rounded-lg border border-border bg-surface-muted text-xs font-bold text-text hover:bg-surface transition-colors shadow-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setCurrentWeekOffset((prev) => prev + 1)}
            aria-label="Next week"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:text-text hover:bg-surface-muted transition-colors shadow-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. DAYS HEADER ROW */}
      <div className="grid grid-cols-8 gap-2 pt-5 pb-4 items-center">
        {/* Calendar Mini Tile Icon (Left Corner) */}
        <div className="flex items-center justify-center">
          <div className="w-10 h-10 rounded-xl bg-surface-muted border border-border flex items-center justify-center text-text-muted shadow-sm">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        </div>

        {/* 7 Days of Week Header Tiles */}
        {DAYS_HEADER.map((day) => {
          const isActive = activeDayIndex === day.dayIndex;
          const displayDate = day.date + currentWeekOffset * 7;
          return (
            <button
              key={day.dayIndex}
              type="button"
              onClick={() => setActiveDayIndex(day.dayIndex)}
              className={`flex flex-col items-center justify-center py-2.5 px-1 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'bg-text text-white shadow-md transform -translate-y-0.5'
                  : 'bg-surface-muted/60 text-text-muted hover:bg-surface-muted hover:text-text'
              }`}
              data-testid={`day-header-${day.dayIndex}`}
            >
              <span
                className={`text-[11px] font-medium ${isActive ? 'text-white/80' : 'text-text-muted'}`}
              >
                {day.name}
              </span>
              <span
                className={`text-lg sm:text-xl font-bold font-display ${isActive ? 'text-white' : 'text-text'}`}
              >
                {displayDate}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. TIME GRID WITH HOURLY ROWS & EVENT CARDS */}
      <div className="relative mt-2 border-t border-border/80 pt-2 min-h-[580px] overflow-x-auto">
        <div className="min-w-[850px] relative">
          {/* Time row markers and horizontal guidelines */}
          {TIME_ROWS.map((row) => (
            <div
              key={row.hour}
              className="grid grid-cols-8 gap-2 items-center h-18 border-b border-border/40 relative"
            >
              <div className="text-xs font-medium text-text-muted/80 pr-2 text-right select-none">
                {row.label}
              </div>
              <div className="col-span-7 h-full w-full" />
            </div>
          ))}

          {/* Column vertical grid dividers */}
          <div className="absolute inset-0 grid grid-cols-8 gap-2 pointer-events-none">
            <div />
            {[0, 1, 2, 3, 4, 5, 6].map((col) => (
              <div
                key={col}
                className={`h-full border-r border-border/30 ${
                  activeDayIndex === col ? 'bg-primary-soft/10' : ''
                }`}
              />
            ))}
          </div>

          {/* Dashed Add Slot on Tuesday 6am - 7am (as seen in Image 1) */}
          <div
            className="absolute top-1 left-[38.5%] w-[11%] h-16 rounded-xl border-2 border-dashed border-border/90 flex items-center justify-center text-text-muted hover:border-primary-strong hover:text-primary-ink cursor-pointer bg-surface/50 transition-colors z-10"
            onClick={() => setShowEventModal(true)}
            title="Add Event at 06:00 - 07:00"
          >
            <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-sm font-bold">
              +
            </div>
          </div>

          {/* Render Calendar Events */}
          {events.map((ev) => {
            // Calculate column left and top position
            // Column width is roughly 1/8 = 12.5%, col 0 starts at 12.5%
            const leftPercent = 12.5 + ev.dayIndex * 12.5 + 0.3;
            // 6 am is top = 0px, 1 hour = 72px (h-18 is 4.5rem = 72px)
            const topPx = (ev.startHour - 6) * 72 + 6;
            const heightPx = Math.max(ev.durationHours * 72 - 8, 48);

            return (
              <div
                key={ev.id}
                style={{
                  left: `${leftPercent}%`,
                  top: `${topPx}px`,
                  height: `${heightPx}px`,
                  width: '11.8%',
                }}
                onClick={() => {
                  setEventTitle(ev.title);
                  setStartTime(ev.startTime);
                  setEndTime(ev.endTime);
                  setShowEventModal(true);
                }}
                className={`absolute p-2.5 rounded-xl cursor-pointer transition-all duration-200 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-md hover:scale-[1.02] z-10 ${getEventStyle(
                  ev.variant,
                )}`}
                data-testid={`calendar-event-${ev.id}`}
              >
                <div>
                  <h4 className="font-bold text-[11px] leading-tight line-clamp-2">{ev.title}</h4>
                  <p className="text-[10px] opacity-80 mt-0.5 font-medium">
                    {ev.startTime} - {ev.endTime}
                  </p>
                  {ev.subtitle && (
                    <span className="inline-flex items-center gap-1 mt-1 text-[9px] font-semibold opacity-90 px-1.5 py-0.5 rounded bg-surface/60 border border-border/40">
                      📄 {ev.subtitle}
                    </span>
                  )}
                </div>

                {/* Optional Graphic attachment or Avatar Group */}
                <div className="flex items-center justify-between gap-1 mt-1">
                  {ev.avatars && ev.avatars.length > 0 && (
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {ev.avatars.map((initials, idx) => (
                        <div
                          key={idx}
                          className="inline-flex h-4 w-4 rounded-full bg-surface text-text text-[8px] font-bold items-center justify-center ring-1 ring-border shadow-2xs"
                        >
                          {initials}
                        </div>
                      ))}
                    </div>
                  )}

                  {ev.hasAttachment && ev.attachmentType === 'image' && (
                    <div className="ml-auto w-4 h-4 rounded bg-surface/70 border border-border/60 flex items-center justify-center text-[8px] opacity-80">
                      ↓
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* 4. FLOATING EVENT CARD / POPOVER ("Meet with Jonson Rider") */}
          {showEventModal && (
            <div
              className="absolute left-[45%] top-8 w-80 sm:w-88 bg-surface rounded-3xl border border-border shadow-2xl p-5 z-30 transition-all animate-in fade-in zoom-in-95 duration-200"
              data-testid="event-popover-card"
            >
              {/* Card Close / Dismiss icon */}
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                aria-label="Close event preview"
                className="absolute top-4 right-4 w-6 h-6 rounded-full hover:bg-surface-muted text-text-muted hover:text-text flex items-center justify-center text-xs font-bold"
              >
                ✕
              </button>

              {/* Event Title with Blinking Caret */}
              <div className="flex items-center pr-6">
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="font-display text-lg font-bold text-text bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                  placeholder="Event Title..."
                />
                <span className="w-0.5 h-5 bg-text animate-pulse ml-0.5" />
              </div>

              {/* Event Attributes */}
              <div className="mt-4 space-y-2.5 text-xs text-text">
                {/* Date Picker row */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-muted border border-border">
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="bg-transparent border-none outline-none font-medium text-text w-full p-0"
                  />
                </div>

                {/* Time range row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <div className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-text-muted shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <input
                        type="text"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="bg-transparent border-none outline-none font-medium text-text w-12 p-0"
                      />
                    </div>
                    <span className="text-[10px] text-text-muted">▼</span>
                  </div>

                  <span className="text-text-muted font-bold">-</span>

                  <div className="flex-1 flex items-center justify-between p-2 rounded-xl bg-surface-muted border border-border">
                    <input
                      type="text"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="bg-transparent border-none outline-none font-medium text-text w-12 p-0"
                    />
                    <span className="text-[10px] text-text-muted">▼</span>
                  </div>
                </div>

                {/* Location row */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-surface-muted border border-border">
                  <svg
                    className="w-4 h-4 text-text-muted shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="bg-transparent border-none outline-none font-medium text-text w-full p-0"
                  />
                </div>
              </div>

              {/* Tag Chips */}
              <div className="flex items-center gap-1.5 flex-wrap mt-3.5">
                <button
                  type="button"
                  onClick={() => setActiveTag('Design')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    activeTag === 'Design'
                      ? 'bg-purple-100 text-purple-900 border-purple-200'
                      : 'bg-surface-muted text-text-muted border-border hover:text-text'
                  }`}
                >
                  Design
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTag('Personal')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    activeTag === 'Personal'
                      ? 'bg-amber-100 text-amber-900 border-amber-200'
                      : 'bg-surface-muted text-text-muted border-border hover:text-text'
                  }`}
                >
                  Personal project
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTag('Developer')}
                  className={`px-3 py-1 rounded-full text-[11px] font-semibold border transition-all ${
                    activeTag === 'Developer'
                      ? 'bg-blue-100 text-blue-900 border-blue-200'
                      : 'bg-surface-muted text-text-muted border-border hover:text-text'
                  }`}
                >
                  Developer task
                </button>
              </div>

              {/* Attendees Row with Avatars and Add Button */}
              <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-200 text-emerald-950 text-[10px] font-bold flex items-center justify-center ring-2 ring-surface shadow-xs">
                    JR
                  </div>
                  <div className="w-7 h-7 rounded-full bg-purple-200 text-purple-950 text-[10px] font-bold flex items-center justify-center ring-2 ring-surface shadow-xs">
                    LP
                  </div>
                  <div className="w-7 h-7 rounded-full bg-blue-200 text-blue-950 text-[10px] font-bold flex items-center justify-center ring-2 ring-surface shadow-xs">
                    TK
                  </div>
                </div>

                <button
                  type="button"
                  className="w-7 h-7 rounded-full border-2 border-dashed border-border flex items-center justify-center text-text-muted hover:border-primary-strong hover:text-text text-sm font-bold transition-colors"
                  title="Add attendee"
                >
                  +
                </button>
              </div>

              {/* Action Buttons: Add Event Pill + Options Menu */}
              <div className="flex items-center gap-1.5 mt-5">
                <button
                  type="button"
                  onClick={handleAddEvent}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-text text-white font-bold text-xs hover:bg-text/90 transition-all shadow-md flex items-center justify-center"
                >
                  Add Event
                </button>
                <button
                  type="button"
                  onClick={() => setShowEventModal(false)}
                  className="py-2.5 px-3 rounded-xl bg-surface-muted border border-border text-text hover:bg-surface font-bold text-xs transition-colors"
                  title="More actions"
                >
                  ···
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
