import { describe, expect, it } from 'vitest';
import type { Approval } from '../../features/approvals/types';
import type { AttendanceRecord } from '../../features/attendance/types';
import type { Task, TaskStatus } from '../../features/tasks/types';
import {
  formatDueDate,
  isForbiddenError,
  localDateString,
  pickActiveTasks,
  summarizeApprovals,
  summarizeAttendance,
  summarizeTasks,
} from '../team-lead-metrics';

const task = (id: string, status: TaskStatus, dueDate: string | null = null, title = id): Task =>
  ({ id, title, status, dueDate, assigneeName: 'A', assigneeEmployeeId: 'e1' }) as Task;

const record = (status: AttendanceRecord['status']): AttendanceRecord =>
  ({ id: status, employeeId: status, status }) as AttendanceRecord;

const approval = (subjectType: string): Approval => ({ id: subjectType, subjectType }) as Approval;

describe('summarizeTasks', () => {
  it('counts every workflow state and gives each its share of the total', () => {
    const s = summarizeTasks([
      task('1', 'completed'),
      task('2', 'in_progress'),
      task('3', 'in_progress'),
      task('4', 'todo'),
    ]);
    expect(s.total).toBe(4);
    expect(s.counts).toEqual({ todo: 1, in_progress: 2, in_review: 0, completed: 1, blocked: 0 });
    expect(s.percents.in_progress).toBe(50);
    expect(s.percents.completed).toBe(25);
  });

  it('keeps To Do and Blocked apart instead of lumping them together as "hold"', () => {
    const s = summarizeTasks([task('1', 'todo'), task('2', 'blocked'), task('3', 'blocked')]);
    expect(s.counts.todo).toBe(1);
    expect(s.counts.blocked).toBe(2);
  });

  it('reports zeros, not made-up numbers, when there are no tasks', () => {
    const s = summarizeTasks([]);
    expect(s.total).toBe(0);
    expect(Object.values(s.counts).every((n) => n === 0)).toBe(true);
    expect(Object.values(s.percents).every((n) => n === 0)).toBe(true);
  });
});

describe('summarizeAttendance', () => {
  it('splits the team into present, late, on leave and absent', () => {
    const s = summarizeAttendance([record('present'), record('late'), record('on_leave')], 6);
    expect(s).toEqual({ present: 1, late: 1, onLeave: 1, absent: 3, checkedIn: 2 });
  });

  it('counts a half day as present', () => {
    expect(summarizeAttendance([record('half_day')], 2).present).toBe(1);
  });

  it('does not call people absent on a holiday or weekend', () => {
    const s = summarizeAttendance([record('holiday'), record('holiday')], 2);
    expect(s.absent).toBe(0);
  });

  it('never goes below zero when there are more records than team members', () => {
    expect(summarizeAttendance([record('present'), record('present')], 1).absent).toBe(0);
  });

  it('shows everyone as absent when nobody has a record yet', () => {
    expect(summarizeAttendance([], 4)).toEqual({
      present: 0,
      late: 0,
      onLeave: 0,
      absent: 4,
      checkedIn: 0,
    });
  });
});

describe('summarizeApprovals', () => {
  it('counts leave and attendance approvals', () => {
    const s = summarizeApprovals([
      approval('leave'),
      approval('leave'),
      approval('attendance_correction'),
      approval('expense'),
    ]);
    expect(s).toEqual({ total: 4, leave: 2, attendance: 1 });
  });
});

describe('pickActiveTasks', () => {
  it('drops completed tasks and puts the soonest due first, undated last', () => {
    const picked = pickActiveTasks([
      task('late', 'in_progress', '2026-12-31'),
      task('done', 'completed', '2026-01-01'),
      task('undated', 'todo', null, 'zzz'),
      task('soon', 'blocked', '2026-11-25'),
    ]);
    expect(picked.map((t) => t.id)).toEqual(['soon', 'late', 'undated']);
  });

  it('returns at most the limit', () => {
    const many = Array.from({ length: 9 }, (_, i) => task(`t${i}`, 'todo', `2026-11-${10 + i}`));
    expect(pickActiveTasks(many, 5)).toHaveLength(5);
  });
});

describe('localDateString', () => {
  it('uses the local calendar day, even just after midnight', () => {
    expect(localDateString(new Date(2026, 10, 25, 0, 30))).toBe('2026-11-25');
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});

describe('formatDueDate', () => {
  it('formats a date and shows a dash when there is none', () => {
    expect(formatDueDate('2026-11-30')).toBe('Nov 30, 2026');
    expect(formatDueDate(null)).toBe('—');
    expect(formatDueDate('not a date')).toBe('—');
  });
});

describe('isForbiddenError', () => {
  it('recognises a 403 from any of the API error classes', () => {
    expect(isForbiddenError(Object.assign(new Error('x'), { status: 403 }))).toBe(true);
    expect(isForbiddenError(Object.assign(new Error('x'), { statusCode: 403 }))).toBe(true);
    expect(isForbiddenError(Object.assign(new Error('x'), { status: 500 }))).toBe(false);
    expect(isForbiddenError('nope')).toBe(false);
  });
});
