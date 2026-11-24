import type { Approval } from '../features/approvals/types';
import type { AttendanceRecord } from '../features/attendance/types';
import { TASK_STATUSES, type Task, type TaskStatus } from '../features/tasks/types';

/** One label per workflow state, as used in the task filters. */
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
  blocked: 'Blocked',
};

export interface TaskBreakdown {
  total: number;
  counts: Record<TaskStatus, number>;
  /** Whole-number share of the total per status (0 when there are no tasks). */
  percents: Record<TaskStatus, number>;
}

export function summarizeTasks(tasks: readonly Task[]): TaskBreakdown {
  const counts = Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
  for (const task of tasks) counts[task.status] += 1;
  const total = tasks.length;
  const percents = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, total > 0 ? Math.round((counts[s] / total) * 100) : 0]),
  ) as Record<TaskStatus, number>;
  return { total, counts, percents };
}

export interface AttendanceBreakdown {
  present: number;
  late: number;
  onLeave: number;
  /** Team members with no attendance today who are not on leave and not off for a holiday. */
  absent: number;
  /** Present plus late: the people who are in. */
  checkedIn: number;
}

/**
 * Splits today's attendance records over the team. Half days count as present. A team member with
 * no record, who is neither on leave nor off for a holiday or weekend, is absent.
 */
export function summarizeAttendance(
  records: readonly AttendanceRecord[],
  teamSize: number,
): AttendanceBreakdown {
  const count = (...statuses: AttendanceRecord['status'][]) =>
    records.filter((r) => statuses.includes(r.status)).length;
  const present = count('present', 'half_day');
  const late = count('late');
  const onLeave = count('on_leave');
  const dayOff = count('holiday', 'weekend');
  const absent = Math.max(0, teamSize - dayOff - present - late - onLeave);
  return { present, late, onLeave, absent, checkedIn: present + late };
}

export interface ApprovalBreakdown {
  total: number;
  leave: number;
  attendance: number;
}

export function summarizeApprovals(approvals: readonly Approval[]): ApprovalBreakdown {
  return {
    total: approvals.length,
    leave: approvals.filter((a) => a.subjectType === 'leave').length,
    attendance: approvals.filter(
      (a) => a.subjectType === 'attendance_correction' || a.subjectType === 'attendance',
    ).length,
  };
}

/** Open tasks, soonest due first (tasks without a due date last), at most `limit`. */
export function pickActiveTasks(tasks: readonly Task[], limit = 5): Task[] {
  return tasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.title.localeCompare(b.title);
    })
    .slice(0, limit);
}

/** Today's date as YYYY-MM-DD in the browser's own time zone (not UTC, which is yesterday before dawn in India). */
export function localDateString(now: Date = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function formatDueDate(dueDate: string | null | undefined): string {
  if (!dueDate) return '—';
  const date = new Date(dueDate);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** True for an API error that means "you may not see this" (HTTP 403). */
export function isForbiddenError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { status?: unknown; statusCode?: unknown };
  return e.status === 403 || e.statusCode === 403;
}
