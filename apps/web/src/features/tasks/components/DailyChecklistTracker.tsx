import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../auth/AuthContext';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { PersonalTodoList } from '../../todos/components/PersonalTodoList';

export interface ChecklistItem {
  id: string;
  title: string;
  createdAt: string;
}

// Map of date string 'YYYY-MM-DD' -> Set of completed checklist item IDs
export type DailyChecklistRecords = Record<string, string[]>;

const DEFAULT_CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'item-1', title: 'Morning Attendance Check-in', createdAt: '2026-01-01' },
  { id: 'item-2', title: 'Daily Standup / Work Plan', createdAt: '2026-01-01' },
  { id: 'item-3', title: 'Review Tasks & Assigned Tickets', createdAt: '2026-01-01' },
  { id: 'item-4', title: 'Work Summary & Updates', createdAt: '2026-01-01' },
  { id: 'item-5', title: 'Evening Attendance Check-out', createdAt: '2026-01-01' },
];

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplayDate(dateKey: string): { dayName: string; formattedDate: string; isToday: boolean } {
  const parts = dateKey.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dateObj = new Date(year, month - 1, day);
  const todayKey = formatDateKey(new Date());

  const isToday = dateKey === todayKey;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  return {
    dayName: dayNames[dateObj.getDay()] ?? 'Day',
    formattedDate: `${monthNames[dateObj.getMonth()] ?? 'Jan'} ${day}`,
    isToday,
  };
}

export function DailyChecklistTracker() {
  const { user } = useAuth();
  const userId = user?.id ?? 'default_user';

  const itemsStorageKey = `maxr_daily_checklist_items_${userId}`;
  const recordsStorageKey = `maxr_daily_checklist_records_${userId}`;

  // Load checklist items
  const [items, setItems] = useState<ChecklistItem[]>(() => {
    try {
      const stored = localStorage.getItem(itemsStorageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return DEFAULT_CHECKLIST_ITEMS;
  });

  // Load records: { 'YYYY-MM-DD': ['item-1', 'item-2'] }
  const [records, setRecords] = useState<DailyChecklistRecords>(() => {
    try {
      const stored = localStorage.getItem(recordsStorageKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {};
  });

  const [newItemTitle, setNewItemTitle] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [daysCount, setDaysCount] = useState<7 | 14 | 30>(7);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(itemsStorageKey, JSON.stringify(items));
    } catch (e) {
      console.error('Failed to save checklist items', e);
    }
  }, [items, itemsStorageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(recordsStorageKey, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save checklist records', e);
    }
  }, [records, recordsStorageKey]);

  // Generate date list from today backwards
  const dateList = useMemo(() => {
    const list: string[] = [];
    const now = new Date();
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      list.push(formatDateKey(d));
    }
    return list;
  }, [daysCount]);

  const handleToggleCheck = (dateKey: string, itemId: string) => {
    setRecords((prev) => {
      const currentList = prev[dateKey] ?? [];
      const isAlreadyChecked = currentList.includes(itemId);
      const nextList = isAlreadyChecked
        ? currentList.filter((id) => id !== itemId)
        : [...currentList, itemId];

      return {
        ...prev,
        [dateKey]: nextList,
      };
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newItemTitle.trim();
    if (!trimmed) return;

    const newItem: ChecklistItem = {
      id: `item-${Date.now()}`,
      title: trimmed,
      createdAt: formatDateKey(new Date()),
    };

    setItems((prev) => [...prev, newItem]);
    setNewItemTitle('');
    setIsAddingItem(false);
  };

  const handleDeleteItem = (itemId: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    // Clean up from records
    setRecords((prev) => {
      const updated: DailyChecklistRecords = {};
      for (const [date, checkedIds] of Object.entries(prev)) {
        updated[date] = checkedIds.filter((id) => id !== itemId);
      }
      return updated;
    });
  };

  // Today's summary stats
  const todayKey = formatDateKey(new Date());
  const todayCheckedCount = (records[todayKey] ?? []).filter((id) =>
    items.some((i) => i.id === id),
  ).length;
  const todayPercentage =
    items.length > 0 ? Math.round((todayCheckedCount / items.length) * 100) : 0;

  return (
    <div className="space-y-8" data-testid="daily-checklist-tracker">
      {/* SECTION 1: Daily Checklist Tracker Table */}
      <div className="bg-surface border border-border rounded-card p-5 sm:p-6 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary-deep flex items-center justify-center font-bold text-sm">
                ✓
              </div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-text">
                Daily Checklist Matrix
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-text-muted mt-1">
              Mark your routine tasks daily. The table tracks completion records day by day.
            </p>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-soft/60 border border-primary-strong/20">
              <span className="text-xs font-semibold text-primary-deep">Today:</span>
              <span className="text-xs font-bold text-primary-deep font-display tabular-nums">
                {todayCheckedCount}/{items.length} ({todayPercentage}%)
              </span>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center rounded-xl bg-surface-muted p-1 border border-border text-xs">
              {( [7, 14, 30] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setDaysCount(count)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                    daysCount === count
                      ? 'bg-surface text-text shadow-xs font-semibold'
                      : 'text-text-muted hover:text-text'
                  }`}
                >
                  {count} Days
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddingItem(!isAddingItem)}
              className="text-xs"
            >
              + Add Checklist Item
            </Button>
          </div>
        </div>

        {/* Add Checklist Item Form */}
        {isAddingItem && (
          <form
            onSubmit={handleAddItem}
            className="p-4 rounded-xl bg-surface-muted border border-border/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-150"
          >
            <div className="flex-1">
              <Input
                placeholder="Enter checklist item title (e.g. Daily Standup, Code Review)..."
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                autoFocus
                className="w-full text-xs sm:text-sm"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button type="submit" variant="primary" size="sm" disabled={!newItemTitle.trim()}>
                Save Item
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingItem(false);
                  setNewItemTitle('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* The Matrix Table: Rows = Checklist Titles, Columns = Dates (Transposed per user requirement) */}
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="bg-surface-muted/70 border-b border-border">
                {/* FIRST COLUMN HEADER: CHECKLIST ITEMS */}
                <th className="py-3 px-4 text-xs font-bold text-text uppercase tracking-wider sticky left-0 bg-surface-muted/95 z-10 w-64 min-w-[220px] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Daily Checklist Item
                </th>

                {/* DATE COLUMN HEADERS (TRANSPOSED) */}
                {dateList.map((dateKey) => {
                  const { dayName, formattedDate, isToday } = formatDisplayDate(dateKey);
                  return (
                    <th
                      key={dateKey}
                      aria-label={`Date: ${formattedDate} (${dayName})`}
                      className={`py-3 px-3 text-xs font-semibold text-text text-center min-w-[90px] border-l border-border/50 ${
                        isToday ? 'bg-primary-soft/30' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-0.5">
                        {isToday ? (
                          <span className="px-2 py-0.5 rounded-full bg-primary-deep text-white font-bold text-[10px] tracking-wide">
                            Today
                          </span>
                        ) : (
                          <span className="text-text-muted text-[11px] font-medium">
                            {dayName}
                          </span>
                        )}
                        <span className="text-text font-bold text-xs">{formattedDate}</span>
                      </div>
                    </th>
                  );
                })}

                {/* OVERALL DONE / FREQUENCY COLUMN */}
                <th className="py-3 px-4 text-xs font-bold text-text text-center w-32 min-w-[120px] border-l border-border/50">
                  Completed
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border/60">
              {items.map((item) => {
                // Calculate completion count for this item across dateList
                let itemDoneDays = 0;
                for (const dateKey of dateList) {
                  if ((records[dateKey] ?? []).includes(item.id)) {
                    itemDoneDays++;
                  }
                }
                const itemPercent =
                  dateList.length > 0 ? Math.round((itemDoneDays / dateList.length) * 100) : 0;

                return (
                  <tr
                    key={item.id}
                    className="transition-colors hover:bg-surface-muted/40 group"
                  >
                    {/* FIRST COLUMN: CHECKLIST TITLE (ROW HEADER) */}
                    <td className="py-3 px-4 text-xs sticky left-0 bg-surface z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-text truncate max-w-[200px]" title={item.title}>
                          {item.title}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-danger rounded transition-opacity cursor-pointer shrink-0"
                            title={`Delete "${item.title}"`}
                            aria-label={`Delete "${item.title}"`}
                          >
                            <svg
                              className="w-3.5 h-3.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="2"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>

                    {/* CELLS: ONE CHECKBOX PER DATE */}
                    {dateList.map((dateKey) => {
                      const { formattedDate } = formatDisplayDate(dateKey);
                      const isChecked = (records[dateKey] ?? []).includes(item.id);

                      return (
                        <td
                          key={dateKey}
                          className="py-3 px-3 text-center border-l border-border/40"
                        >
                          <button
                            type="button"
                            onClick={() => handleToggleCheck(dateKey, item.id)}
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-primary text-text shadow-xs ring-2 ring-primary-strong/30 scale-105'
                                : 'border border-border-strong bg-surface hover:bg-surface-muted hover:border-text-muted'
                            }`}
                            title={`${item.title} on ${formattedDate}: ${
                              isChecked ? 'Completed' : 'Pending'
                            }`}
                            aria-label={`Toggle ${item.title} for ${formattedDate}`}
                          >
                            {isChecked ? (
                              <svg
                                className="w-4 h-4 text-text stroke-[3]"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            ) : null}
                          </button>
                        </td>
                      );
                    })}

                    {/* ROW COMPLETION SUMMARY: FREQUENCY FOR THIS ITEM */}
                    <td className="py-3 px-4 text-center border-l border-border/40">
                      <div className="flex flex-col items-center gap-1">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            itemPercent === 100
                              ? 'text-primary-deep'
                              : itemPercent > 0
                                ? 'text-text'
                                : 'text-text-muted'
                          }`}
                        >
                          {itemDoneDays}/{dateList.length} days
                        </span>
                        <div className="w-16 h-1.5 bg-surface-muted rounded-full overflow-hidden border border-border/50">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              itemPercent === 100 ? 'bg-primary-deep' : 'bg-primary'
                            }`}
                            style={{ width: `${itemPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            <tfoot>
              <tr className="bg-surface-muted/60 border-t-2 border-border font-semibold text-xs">
                <td className="py-3 px-4 sticky left-0 bg-surface-muted/95 z-10 text-text font-bold shadow-[2px_0_5px_-2px_rgba(0,0,0,0.06)]">
                  Daily Completed
                </td>
                {dateList.map((dateKey) => {
                  const dayCheckedIds = records[dateKey] ?? [];
                  const doneCount = dayCheckedIds.filter((id) =>
                    items.some((i) => i.id === id),
                  ).length;
                  return (
                    <td
                      key={dateKey}
                      className="py-3 px-3 text-center border-l border-border/50 tabular-nums text-text font-bold"
                    >
                      {doneCount}/{items.length}
                    </td>
                  );
                })}
                <td className="py-3 px-4 text-center border-l border-border/50 text-text font-bold">
                  —
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 2: Personal To-Do List */}
      <div className="bg-surface border border-border rounded-card p-5 sm:p-6 shadow-card space-y-4">
        <div className="pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary-soft text-primary-deep flex items-center justify-center font-bold text-sm">
              📝
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold font-display text-text">
                Personal To-Do List
              </h2>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                Add personal tasks, deadlines, and manage items with full persistence.
              </p>
            </div>
          </div>
        </div>

        <PersonalTodoList pageSize={10} />
      </div>
    </div>
  );
}
