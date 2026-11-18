import { useState } from 'react';
import type { Task } from '../types';

export interface TaskCalendarProps {
  tasks?: Task[];
  onSelectTask?: (task: Task) => void;
  metrics?: {
    total: number;
    inProgress: number;
    blocked: number;
    completed: number;
    overdue: number;
  };
}

interface CalendarItem {
  id: string;
  dateStr: string;
  dayNum: number;
  title: string;
  lane: 1 | 2 | 3;
  isHero?: boolean;
}

export function TaskCalendar({ onSelectTask, metrics }: TaskCalendarProps) {
  const [selectedDay, setSelectedDay] = useState(14);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const days = [
    { num: 11, label: '11 Feb', isWeekend: false },
    { num: 12, label: '12 Feb', isWeekend: false },
    { num: 13, label: '13 Feb', isWeekend: false },
    { num: 14, label: '14 Feb', isWeekend: false },
    { num: 15, label: '15 Feb', isWeekend: false },
    { num: 16, label: '16 Feb', isWeekend: true }, // Hatched weekend block
    { num: 17, label: '17 Feb', isWeekend: false },
    { num: 18, label: '18 Feb', isWeekend: false },
  ];

  const taskSubmitFinal: CalendarItem = {
    id: 'task-1',
    dateStr: '11 Feb',
    dayNum: 11,
    title: 'Submit Final Screens',
    lane: 1,
  };

  const taskClientFeedback: CalendarItem = {
    id: 'task-2',
    dateStr: '11 Feb',
    dayNum: 11,
    title: 'Client Feedback',
    lane: 2,
  };

  const taskDraftProposal: CalendarItem = {
    id: 'task-3',
    dateStr: '',
    dayNum: 10,
    title: 'Draft Client Proposal',
    lane: 3,
  };

  const taskFeedbackMeeting: CalendarItem = {
    id: 'task-4',
    dateStr: '12 Feb',
    dayNum: 12,
    title: 'Client Feedback Meeting',
    lane: 3,
  };

  const taskUiTesting: CalendarItem = {
    id: 'task-5',
    dateStr: '13 Feb',
    dayNum: 13,
    title: 'UI Testing',
    lane: 2,
  };

  const taskPrototypeTesting: CalendarItem = {
    id: 'task-6',
    dateStr: '14 Feb',
    dayNum: 14,
    title: 'Prototype Testing',
    lane: 1,
    isHero: true,
  };

  const taskFinalizeUi: CalendarItem = {
    id: 'task-7',
    dateStr: '15 Feb',
    dayNum: 15,
    title: 'Finalize UI Screens',
    lane: 3,
  };

  const taskUpdateStyle: CalendarItem = {
    id: 'task-8',
    dateStr: '17 Feb',
    dayNum: 17,
    title: 'Update Style',
    lane: 2,
  };

  const handleTaskClick = (item: CalendarItem) => {
    if (onSelectTask) {
      onSelectTask({
        id: item.id,
        title: item.title,
        description: `Scheduled for ${item.dateStr || 'Feb'}. Milestone execution and testing track.`,
        projectId: null,
        projectName: 'MAXR Product Sprint',
        assigneeEmployeeId: 'mock-assignee-emp',
        assigneeName: 'Current Staff',
        assignerEmployeeId: 'mock-assigner-lead',
        assignerName: 'Team Lead',
        status: item.isHero ? 'in_progress' : 'todo',
        priority: item.isHero ? 'urgent' : 'medium',
        dueDate: `2026-02-${String(item.dayNum).padStart(2, '0')}`,
        isOverdue: false,
        completedAt: null,
        version: 1,
        createdAt: '2026-02-01T00:00:00Z',
        updatedAt: '2026-02-01T00:00:00Z',
      });
    }
  };

  return (
    <div
      className="w-full rounded-[24px] p-5 sm:p-6 shadow-xs hover:shadow-md transition-all duration-300 relative"
      style={{
        backgroundColor: 'rgb(255, 255, 255)',
        border: '1px solid rgba(8, 11, 12, 0.08)',
      }}
      data-testid="task-calendar-view"
    >
      {/* Header Row: Title & Options Menu */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-lg font-bold font-display tracking-tight"
          style={{ color: 'rgb(8, 11, 12)' }}
        >
          Task Calendar
        </h2>

        {/* Options Button (...) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:bg-stone-100 shadow-xs active:scale-95"
            style={{
              border: '1px solid rgba(8, 11, 12, 0.1)',
              color: 'rgb(8, 11, 12)',
            }}
            aria-label="Calendar options"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="6" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="18" cy="12" r="1.5" />
            </svg>
          </button>

          {/* Quick Metrics Dropdown */}
          {isMenuOpen && metrics && (
            <div
              className="absolute right-0 top-10 w-52 p-3 rounded-2xl shadow-xl z-30 transition-all text-xs space-y-1.5"
              style={{
                backgroundColor: 'rgb(255, 255, 255)',
                border: '1px solid rgba(8, 11, 12, 0.1)',
              }}
            >
              <p className="font-semibold text-stone-500 uppercase text-[10px] tracking-wider mb-1">
                Tasks Snapshot
              </p>
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span className="text-stone-600">Total:</span>
                <span className="font-bold font-mono">{metrics.total}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span style={{ color: 'rgb(85, 205, 179)' }}>In Flight:</span>
                <span className="font-bold font-mono" style={{ color: 'rgb(15, 118, 110)' }}>
                  {metrics.inProgress}
                </span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span className="text-rose-600">Blocked:</span>
                <span className="font-bold font-mono text-rose-600">{metrics.blocked}</span>
              </div>
              <div className="flex justify-between py-0.5 border-b border-stone-100">
                <span className="text-emerald-700">Completed:</span>
                <span className="font-bold font-mono text-emerald-700">{metrics.completed}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-red-600">Overdue:</span>
                <span className="font-bold font-mono text-red-600">{metrics.overdue}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Timeline Area */}
      <div className="overflow-x-auto pb-2 scrollbar-thin">
        <div className="min-w-[760px] relative">
          {/* Days Header Row */}
          <div className="grid grid-cols-8 gap-0 text-center mb-4">
            {days.map((day) => {
              const isSelected = selectedDay === day.num;
              return (
                <div key={day.num} className="relative flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => setSelectedDay(day.num)}
                    className="text-xs transition-colors hover:text-black py-1 focus:outline-none"
                    style={{
                      color: isSelected ? 'rgb(8, 11, 12)' : 'rgba(8, 11, 12, 0.55)',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    {day.label}
                  </button>

                  {/* Active Pin Marker on Selected Day */}
                  {isSelected && (
                    <div className="flex flex-col items-center w-full relative z-20">
                      {/* Top Pin Dot */}
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: 'rgb(8, 11, 12)' }}
                      />
                      {/* Vertical Indicator Line */}
                      <div
                        className="w-[1.5px] h-44 absolute top-1.5"
                        style={{ backgroundColor: 'rgb(8, 11, 12)' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Timeline Grid Body */}
          <div className="relative h-44 grid grid-cols-8 gap-0">
            {/* 8 Column Vertical Dividing Lines & Shaded Weekend */}
            {days.map((day) => (
              <div
                key={day.num}
                className="relative h-full border-r last:border-r-0"
                style={{
                  borderColor: 'rgba(8, 11, 12, 0.06)',
                }}
              >
                {/* 16 Feb Hatched Weekend Shading */}
                {day.isWeekend && (
                  <div
                    className="absolute inset-0 mx-1 rounded-2xl"
                    style={{
                      background:
                        'repeating-linear-gradient(45deg, rgba(8, 11, 12, 0.035), rgba(8, 11, 12, 0.035) 6px, transparent 6px, transparent 12px)',
                      border: '1px dashed rgba(8, 11, 12, 0.1)',
                    }}
                    title="Weekend Sprint Buffer"
                  />
                )}
              </div>
            ))}

            {/* Task Pills Placed Absolutely Across Grid Lanes */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Lane 1 (Top Lane) */}
              <div className="absolute top-2 inset-x-0 h-10 flex items-center pointer-events-auto">
                {/* 11 Feb Submit Final Screens */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskSubmitFinal)}
                  className="absolute left-[7%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[190px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="11 Feb Submit Final Screens"
                >
                  <span className="font-semibold mr-1.5">11 Feb</span>
                  Submit Final Screens
                </button>

                {/* 14 Feb Prototype Testing (Hero Black Pill) */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskPrototypeTesting)}
                  className="absolute left-[38.5%] px-4 py-1.5 rounded-full text-xs font-semibold shadow-md hover:-translate-y-0.5 hover:shadow-lg transition-all duration-200 z-30"
                  style={{
                    backgroundColor: 'rgb(8, 11, 12)',
                    color: 'rgb(255, 255, 255)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                  }}
                  title="14 Feb Prototype Testing (Active Milestone)"
                >
                  <span className="mr-1.5 font-bold">14 Feb</span>
                  Prototype Testing
                </button>
              </div>

              {/* Lane 2 (Middle Lane) */}
              <div className="absolute top-16 inset-x-0 h-10 flex items-center pointer-events-auto">
                {/* 11 Feb Client Feedback */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskClientFeedback)}
                  className="absolute left-[7%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[175px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="11 Feb Client Feedback"
                >
                  <span className="font-semibold mr-1.5">11 Feb</span>
                  Client Feedback
                </button>

                {/* 13 Feb UI Testing */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskUiTesting)}
                  className="absolute left-[26%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[150px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="13 Feb UI Testing"
                >
                  <span className="font-semibold mr-1.5">13 Feb</span>
                  UI Testing
                </button>

                {/* 17 Feb Update Style */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskUpdateStyle)}
                  className="absolute left-[76%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[160px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="17 Feb Update Style"
                >
                  <span className="font-semibold mr-1.5">17 Feb</span>
                  Update Style
                </button>
              </div>

              {/* Lane 3 (Bottom Lane) */}
              <div className="absolute top-28 inset-x-0 h-10 flex items-center pointer-events-auto">
                {/* Draft Client Proposal (Left Overflow) */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskDraftProposal)}
                  className="absolute -left-[2%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[160px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="Draft Client Proposal"
                >
                  Draft Client Proposal
                </button>

                {/* 12 Feb Client Feedback Meeting */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskFeedbackMeeting)}
                  className="absolute left-[15%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[210px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="12 Feb Client Feedback Meeting"
                >
                  <span className="font-semibold mr-1.5">12 Feb</span>
                  Client Feedback Meeting
                </button>

                {/* 15 Feb Finalize UI Screens */}
                <button
                  type="button"
                  onClick={() => handleTaskClick(taskFinalizeUi)}
                  className="absolute left-[52%] px-3 py-1 rounded-full text-xs font-medium shadow-xs hover:-translate-y-0.5 hover:shadow-sm transition-all duration-200 truncate max-w-[190px]"
                  style={{
                    backgroundColor: 'rgb(244, 247, 246)',
                    color: 'rgb(8, 11, 12)',
                    border: '1px solid rgba(8, 11, 12, 0.08)',
                  }}
                  title="15 Feb Finalize UI Screens"
                >
                  <span className="font-semibold mr-1.5">15 Feb</span>
                  Finalize UI Screens
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
