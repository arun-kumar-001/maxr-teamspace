import { describe, expect, it } from 'vitest';
import {
  TASK_STATUSES,
  TASK_TRANSITIONS,
  TaskParty,
  TaskStatus,
  checkTransition,
} from './task-rules';

const assignee: TaskParty = { isAssignee: true, isAssigner: false, isAdmin: false };
const assigner: TaskParty = { isAssignee: false, isAssigner: true, isAdmin: false };
const admin: TaskParty = { isAssignee: false, isAssigner: false, isAdmin: true };
const stranger: TaskParty = { isAssignee: false, isAssigner: false, isAdmin: false };
const selfAssigned: TaskParty = { isAssignee: true, isAssigner: true, isAdmin: false };

const LEGAL: Array<[TaskStatus, TaskStatus]> = [
  ['todo', 'in_progress'],
  ['in_progress', 'todo'],
  ['in_progress', 'in_review'],
  ['in_progress', 'blocked'],
  ['in_review', 'in_progress'],
  ['in_review', 'completed'],
  ['blocked', 'in_progress'],
  ['completed', 'in_progress'],
];

describe('the task transition table (D-14)', () => {
  it('is exactly the eight moves of the decision', () => {
    const all = TASK_STATUSES.flatMap((from) => TASK_TRANSITIONS[from].map((to) => [from, to]));
    expect(all.map((move) => move.join('>')).sort()).toEqual(
      LEGAL.map((move) => move.join('>')).sort(),
    );
  });

  it.each(
    TASK_STATUSES.flatMap((from) =>
      TASK_STATUSES.filter((to) => !LEGAL.some(([f, t]) => f === from && t === to)).map((to) => [
        from,
        to,
      ]),
    ) as Array<[TaskStatus, TaskStatus]>,
  )('%s to %s is illegal for everyone who may touch the task', (from, to) => {
    for (const party of [assignee, assigner, admin, selfAssigned]) {
      expect(checkTransition(from, to, party)).toMatchObject({ ok: false, reason: 'illegal' });
    }
  });

  it.each(LEGAL.filter(([from, to]) => from !== 'completed' && to !== 'completed'))(
    '%s to %s is open to the assignee, the assigner and an Admin',
    (from, to) => {
      for (const party of [assignee, assigner, admin, selfAssigned]) {
        expect(checkTransition(from, to, party)).toEqual({ ok: true });
      }
    },
  );

  it('lets only the assigner or an Admin complete a task: the assignee moves it to review', () => {
    expect(checkTransition('in_review', 'completed', assignee)).toMatchObject({
      ok: false,
      reason: 'forbidden',
    });
    expect(checkTransition('in_review', 'completed', assigner)).toEqual({ ok: true });
    expect(checkTransition('in_review', 'completed', admin)).toEqual({ ok: true });
    expect(checkTransition('in_progress', 'in_review', assignee)).toEqual({ ok: true });
  });

  it('lets only the assigner or an Admin reopen a completed task', () => {
    expect(checkTransition('completed', 'in_progress', assignee)).toMatchObject({
      ok: false,
      reason: 'forbidden',
    });
    expect(checkTransition('completed', 'in_progress', assigner)).toEqual({ ok: true });
    expect(checkTransition('completed', 'in_progress', admin)).toEqual({ ok: true });
  });

  it('lets someone who assigned a task to themselves do all of it', () => {
    expect(checkTransition('in_review', 'completed', selfAssigned)).toEqual({ ok: true });
    expect(checkTransition('completed', 'in_progress', selfAssigned)).toEqual({ ok: true });
  });

  it('refuses a stranger everything, and says nothing about which moves are legal', () => {
    for (const from of TASK_STATUSES) {
      for (const to of TASK_STATUSES) {
        const verdict = checkTransition(from, to, stranger);
        expect(verdict).toMatchObject({ ok: false, reason: 'forbidden' });
        expect(JSON.stringify(verdict)).not.toContain('can become');
      }
    }
  });

  it('names the moves that are open when one is illegal', () => {
    const verdict = checkTransition('todo', 'completed', assigner);
    expect(verdict).toMatchObject({ ok: false, reason: 'illegal' });
    expect((verdict as { message: string }).message).toContain('in_progress');
  });
});
