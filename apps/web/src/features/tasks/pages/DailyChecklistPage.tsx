import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthContext';
import { ROLES } from '@maxr/shared';
import {
  getSidebarTodos,
  getSidebarTodoStats,
  isTodoCompletedToday,
  toggleSidebarTodo,
  addSidebarTodo,
  updateSidebarTodo,
  deleteSidebarTodo,
  type TodoItemData,
  TODOS_UPDATED_EVENT,
  TODOS_STORAGE_KEY,
} from '../utils/todoStats';

export function DailyChecklistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [todos, setTodos] = useState<TodoItemData[]>(() => getSidebarTodos());
  const [stats, setStats] = useState(() => getSidebarTodoStats());
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'daily' | 'once'>('all');
  const [newTitle, setNewTitle] = useState('');
  const [newFrequency, setNewFrequency] = useState<'daily' | 'once'>('daily');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editFrequency, setEditFrequency] = useState<'daily' | 'once'>('daily');

  useEffect(() => {
    const handleUpdate = () => {
      setTodos(getSidebarTodos());
      setStats(getSidebarTodoStats());
    };
    window.addEventListener(TODOS_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(TODOS_UPDATED_EVENT, handleUpdate);
  }, []);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isToday = selectedDate === todayStr;

  // Filter items
  const filteredTodos = useMemo(() => {
    return todos.filter((item) => {
      if (filter === 'daily') return item.frequency === 'daily';
      if (filter === 'once') return item.frequency === 'once';
      return true;
    });
  }, [todos, filter]);

  // Date-wise completion stats
  const dateCompletedCount = useMemo(() => {
    return todos.filter((item) => isTodoCompletedToday(item, selectedDate)).length;
  }, [todos, selectedDate]);

  const dateTotalCount = todos.length;
  const datePct = dateTotalCount > 0 ? Math.round((dateCompletedCount / dateTotalCount) * 100) : 0;

  // Toggle item completion for selected date
  const handleToggle = (id: string) => {
    if (selectedDate === todayStr) {
      toggleSidebarTodo(id);
      setTodos(getSidebarTodos());
      setStats(getSidebarTodoStats());
    } else {
      // Toggle for historical date
      const updated = todos.map((item) => {
        if (item.id !== id) return item;
        const dates = Array.isArray(item.completedDates) ? [...item.completedDates] : [];
        const exists = dates.includes(selectedDate);
        const nextDates = exists ? dates.filter((d) => d !== selectedDate) : [...dates, selectedDate];
        return { ...item, completedDates: nextDates };
      });
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // ignore
        }
      }
      setTodos(updated);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    addSidebarTodo(newTitle.trim(), newFrequency);
    setNewTitle('');
    setIsAdding(false);
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSidebarTodo(id);
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
  };

  const handleStartEdit = (item: TodoItemData, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditFrequency(item.frequency);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditTitle('');
  };

  const handleSaveEdit = (id: string, e: React.MouseEvent | React.FormEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!editTitle.trim()) return;
    updateSidebarTodo(id, { title: editTitle.trim(), frequency: editFrequency });
    setTodos(getSidebarTodos());
    setStats(getSidebarTodoStats());
    setEditingId(null);
    setEditTitle('');
  };

  // Day navigation helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const handleJumpToToday = () => {
    setSelectedDate(todayStr);
  };

  // Date Range CSV Export (Start to End date)
  const handleExport = (start = startDate, end = endDate) => {
    const dates: string[] = [];
    const minDate = start <= end ? new Date(start) : new Date(end);
    const maxDate = start <= end ? new Date(end) : new Date(start);

    const iter = new Date(minDate);
    while (iter <= maxDate) {
      dates.push(iter.toISOString().slice(0, 10));
      iter.setDate(iter.getDate() + 1);
    }

    const headers = [
      'Date',
      'Day of Week',
      'Employee Name',
      'Role',
      'Item ID',
      'Item Title',
      'Frequency',
      'Status',
      'Completed Count For Day',
      'Total Items For Day',
      'Day Completion Rate',
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const rows: string[] = [];

    let totalChecksPossible = 0;
    let totalChecksCompleted = 0;

    for (const d of dates) {
      const parts = d.split('-').map(Number);
      const dObj = new Date(parts[0] ?? 2026, (parts[1] ?? 1) - 1, parts[2] ?? 1);
      const dayName = dayNames[dObj.getDay()] ?? 'Day';

      const completedCount = todos.filter((t) => isTodoCompletedToday(t, d)).length;
      const totalCount = todos.length;
      const rate = totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : '0%';

      totalChecksPossible += totalCount;
      totalChecksCompleted += completedCount;

      for (const t of todos) {
        const isDone = isTodoCompletedToday(t, d);
        rows.push(
          [
            `"${d}"`,
            `"${dayName}"`,
            `"${user?.name ?? 'Employee'}"`,
            `"${user?.role ?? 'Staff'}"`,
            `"${t.id}"`,
            `"${t.title.replace(/"/g, '""')}"`,
            `"${t.frequency}"`,
            `"${isDone ? 'Completed' : 'Incomplete'}"`,
            `"${completedCount}"`,
            `"${totalCount}"`,
            `"${rate}"`,
          ].join(','),
        );
      }
    }

    // Summary section
    rows.push('');
    rows.push(`"--- DATE RANGE AUDIT SUMMARY ---",,,,,,,,,,`);
    rows.push(`"Selected Date Range","${start} to ${end}",,,,,,,,,,`);
    rows.push(`"Total Days Covered","${dates.length}",,,,,,,,,,`);
    rows.push(`"Total Checks Completed","${totalChecksCompleted} of ${totalChecksPossible}",,,,,,,,,,`);
    const overallRate =
      totalChecksPossible > 0 ? `${Math.round((totalChecksCompleted / totalChecksPossible) * 100)}%` : '0%';
    rows.push(`"Overall Completion Rate","${overallRate}",,,,,,,,,,`);
    rows.push(`"Export Timestamp","${new Date().toISOString()}",,,,,,,,,,`);

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `maxr-daily-checklist-report-${start}-to-${end}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="flex flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full"
      data-testid="personal-checklist-page"
    >
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-text-muted">
        <button
          type="button"
          onClick={() => navigate(user?.role === ROLES.STAFF ? '/profile' : '/dashboard')}
          className="hover:text-primary-ink transition-colors font-medium cursor-pointer"
        >
          {user?.role === ROLES.STAFF ? 'My Profile' : 'Dashboard'}
        </button>
        <span className="text-border-strong select-none">/</span>
        <button
          type="button"
          onClick={() => navigate(user?.role === ROLES.STAFF ? '/staff/tasks' : '/tasks')}
          className="hover:text-primary-ink transition-colors font-medium cursor-pointer"
        >
          Tasks
        </button>
        <span className="text-border-strong select-none">/</span>
        <span className="text-text font-semibold" aria-current="page">
          Personal Checklist
        </span>
      </nav>

      {/* 2. Page Header with Day Navigation and Download Report Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-text tracking-tight">
              Personal Checklist
            </h1>
            <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-primary-soft text-primary-deep border border-primary/20">
              {dateCompletedCount}/{dateTotalCount} Done
            </span>
          </div>
          <p className="text-sm text-text-muted mt-1">
            Manage your personal daily checklist, track routine items, and export audit reports.
          </p>
        </div>

        {/* Date Selector & Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Day Navigation Controls */}
          <div className="flex items-center gap-1 bg-white border border-border rounded-xl p-1 shadow-xs">
            <button
              type="button"
              onClick={handlePrevDay}
              aria-label="Previous day"
              title="Previous day"
              className="p-1.5 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="text-xs font-semibold px-2 py-1 border-0 bg-transparent text-text focus:ring-1 focus:ring-primary rounded cursor-pointer"
              aria-label="Select report date"
            />

            <button
              type="button"
              onClick={handleNextDay}
              aria-label="Next day"
              title="Next day"
              className="p-1.5 rounded-lg hover:bg-surface-muted text-text-muted hover:text-text transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={handleJumpToToday}
                className="px-2 py-1 text-[11px] font-semibold text-primary-deep bg-primary-soft hover:bg-primary/20 rounded-md transition-colors cursor-pointer ml-1"
              >
                Today
              </button>
            )}
          </div>

          {/* Add Routine Item Button */}
          <button
            type="button"
            onClick={() => setIsAdding((prev) => !prev)}
            data-testid="page-add-checklist-btn"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-primary-deep text-white hover:bg-primary-ink shadow-xs transition-colors cursor-pointer"
          >
            <span className="text-base font-bold leading-none">+</span>
            <span>Add Routine</span>
          </button>
        </div>
      </div>

      {/* Date Range Export Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3.5 p-4 bg-white border border-border/80 rounded-2xl shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 shadow-xs">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </span>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-text">Export Routine Checklist Report</h2>
            <p className="text-[11px] text-text-muted">Select Start and End dates to export comprehensive day-wise audit report</p>
          </div>
        </div>

        {/* Start to End Date Inputs + Quick Presets + Export Button */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-text-muted font-semibold text-[11px]">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => e.target.value && setStartDate(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg border border-border bg-surface text-text font-medium cursor-pointer"
              aria-label="Start Date"
              data-testid="export-start-date"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <label className="text-text-muted font-semibold text-[11px]">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => e.target.value && setEndDate(e.target.value)}
              className="px-2 py-1 text-xs rounded-lg border border-border bg-surface text-text font-medium cursor-pointer"
              aria-label="End Date"
              data-testid="export-end-date"
            />
          </div>

          <div className="hidden lg:flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setStartDate(todayStr);
                setEndDate(todayStr);
              }}
              className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-surface-muted text-text-muted transition-colors cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 6);
                setStartDate(d.toISOString().slice(0, 10));
                setEndDate(todayStr);
              }}
              className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-surface-muted text-text-muted transition-colors cursor-pointer"
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                const d = new Date();
                d.setDate(d.getDate() - 29);
                setStartDate(d.toISOString().slice(0, 10));
                setEndDate(todayStr);
              }}
              className="px-2 py-1 text-[11px] rounded-md border border-border hover:bg-surface-muted text-text-muted transition-colors cursor-pointer"
            >
              30 Days
            </button>
          </div>

          {/* Export Button */}
          <button
            type="button"
            onClick={() => handleExport(startDate, endDate)}
            data-testid="download-checklist-report-btn"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors cursor-pointer"
            title={`Export checklist report from ${startDate} to ${endDate}`}
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* 3. Daily Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-border/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-muted">Total Routines</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-text">{dateTotalCount}</span>
            <span className="text-xs text-text-muted">Habits active</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-border/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-muted">Completed for Date</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-emerald-600">{dateCompletedCount}</span>
            <span className="text-xs text-emerald-700 font-medium">{datePct}% Rate</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-border/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-muted">Pending Items</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="font-display text-2xl sm:text-3xl font-bold text-amber-600">
              {Math.max(0, dateTotalCount - dateCompletedCount)}
            </span>
            <span className="text-xs text-text-muted">Remaining</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-border/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-semibold text-text-muted">Daily Target Status</span>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-2 flex-1 bg-surface-muted rounded-full overflow-hidden border border-border/40">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${datePct}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-text">{datePct}%</span>
          </div>
        </div>
      </div>

      {/* 4. Inline Add Form */}
      {isAdding && (
        <form
          onSubmit={handleAdd}
          className="p-4 bg-primary-soft/40 border border-primary/20 rounded-2xl space-y-3 animate-fadeIn"
          data-testid="page-add-todo-form"
        >
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Daily standup check, review merge requests, clock-out..."
              autoFocus
              className="flex-1 text-sm rounded-xl border border-border bg-white px-3.5 py-2 text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
              data-testid="page-new-todo-input"
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setNewFrequency('daily')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    newFrequency === 'daily'
                      ? 'bg-primary-deep text-white'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setNewFrequency('once')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    newFrequency === 'once'
                      ? 'bg-primary-deep text-white'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  Once
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setNewTitle('');
                }}
                className="px-3 py-2 text-xs rounded-xl border border-border text-text-muted hover:bg-surface-muted transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                data-testid="page-save-todo-btn"
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
              >
                Save Routine
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 5. Filter Tabs */}
      <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-2">
        <div className="flex items-center gap-1">
          {(['all', 'daily', 'once'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              data-testid={`page-filter-${tab}`}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors cursor-pointer ${
                filter === tab
                  ? 'bg-primary-deep text-white shadow-xs'
                  : 'text-text-muted hover:text-text hover:bg-surface-muted'
              }`}
            >
              {tab === 'all' ? 'All Routines' : tab === 'daily' ? 'Daily Habits' : 'One-Time Tasks'}
            </button>
          ))}
        </div>

        <span className="text-xs text-text-muted">
          Viewing status for: <strong className="text-text font-semibold">{selectedDate}</strong>
        </span>
      </div>

      {/* 6. Checklist Items List */}
      <div className="space-y-2">
        {filteredTodos.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted bg-white rounded-2xl border border-border">
            No routines or checklist items found. Click "+ Add Routine" to create your first checklist item.
          </div>
        ) : (
          filteredTodos.map((item) => {
            const completed = isTodoCompletedToday(item, selectedDate);
            const isEditing = editingId === item.id;

            if (isEditing) {
              return (
                <div
                  key={item.id}
                  data-testid={`page-todo-item-${item.id}`}
                  className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-primary-strong/60 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-primary-deep uppercase tracking-wider">
                      Edit Checklist Item
                    </span>
                    <div className="flex items-center gap-1 bg-surface border border-border rounded-lg p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditFrequency('daily')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          editFrequency === 'daily'
                            ? 'bg-primary-deep text-white'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        Daily
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditFrequency('once')}
                        className={`px-2.5 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                          editFrequency === 'once'
                            ? 'bg-primary-deep text-white'
                            : 'text-text-muted hover:text-text'
                        }`}
                      >
                        Once
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      placeholder="Enter checklist item title..."
                      data-testid={`page-edit-input-${item.id}`}
                      autoFocus
                      className="flex-1 px-3 py-2 text-sm bg-surface border border-border rounded-xl text-text placeholder:text-text-subtle focus:outline-none focus:ring-2 focus:ring-primary-strong"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id, e);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-2 text-xs rounded-xl border border-border text-text-muted hover:bg-surface-muted transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handleSaveEdit(item.id, e)}
                      disabled={!editTitle.trim()}
                      data-testid={`page-save-edit-btn-${item.id}`}
                      className="px-4 py-2 text-xs font-semibold rounded-xl bg-primary-deep text-white hover:bg-primary-ink disabled:opacity-50 transition-colors shadow-xs cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={item.id}
                onClick={() => handleToggle(item.id)}
                data-testid={`page-todo-item-${item.id}`}
                className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white border border-border/80 hover:border-border hover:shadow-xs transition-all duration-150 cursor-pointer group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    aria-label={`Toggle ${item.title}`}
                    className="shrink-0 cursor-pointer"
                  >
                    {completed ? (
                      <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                        ✓
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-border-strong group-hover:border-primary-deep transition-colors" />
                    )}
                  </button>

                  <div className="min-w-0">
                    <p
                      className={`text-sm font-semibold truncate transition-colors ${
                        completed ? 'line-through text-text-muted' : 'text-text'
                      }`}
                    >
                      {item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10.5px] px-2 py-0.5 rounded-full font-medium bg-surface-muted text-text-muted border border-border capitalize">
                        {item.frequency === 'daily' ? 'Daily Habit' : 'One-Time'}
                      </span>
                      {completed && (
                        <span className="text-[10.5px] text-emerald-600 font-medium">
                          Completed on {selectedDate}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handleStartEdit(item, e)}
                    data-testid={`page-edit-btn-${item.id}`}
                    aria-label={`Edit ${item.title}`}
                    className="opacity-0 group-hover:opacity-100 hover:text-primary-deep text-text-muted p-1.5 rounded-lg hover:bg-surface-muted transition-all shrink-0 cursor-pointer"
                    title="Edit routine"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => handleDelete(item.id, e)}
                    data-testid={`page-delete-btn-${item.id}`}
                    aria-label={`Delete ${item.title}`}
                    className="opacity-0 group-hover:opacity-100 hover:text-danger text-text-muted p-1.5 rounded-lg hover:bg-surface-muted transition-all shrink-0 cursor-pointer"
                    title="Delete routine"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" />
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
