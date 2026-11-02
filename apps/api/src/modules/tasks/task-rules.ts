export const TASK_STATUSES = ['todo', 'in_progress', 'in_review', 'completed', 'blocked'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Every move a task can make (D-14). A move that is not listed is illegal (422). */
export const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  todo: ['in_progress'],
  in_progress: ['todo', 'in_review', 'blocked'],
  in_review: ['in_progress', 'completed'],
  blocked: ['in_progress'],
  completed: ['in_progress'],
};

export interface TaskParty {
  isAssignee: boolean;
  /** The Team Lead who assigned the task (or created it as an Admin). */
  isAssigner: boolean;
  isAdmin: boolean;
}

export type TransitionVerdict =
  { ok: true } | { ok: false; reason: 'forbidden' | 'illegal'; message: string };

/**
 * Whether `party` may move a task from `from` to `to` (D-14).
 * Only the assignee, the assigner and an Admin may move a task at all. Of those, only the
 * assigner or an Admin may complete a task or reopen a completed one; the assignee moves it to
 * review. The rights are checked first so a stranger learns nothing about legal moves.
 */
export function checkTransition(
  from: TaskStatus,
  to: TaskStatus,
  party: TaskParty,
): TransitionVerdict {
  if (!party.isAssignee && !party.isAssigner && !party.isAdmin) {
    return { ok: false, reason: 'forbidden', message: 'You cannot change the status of this task' };
  }
  if (!TASK_TRANSITIONS[from].includes(to)) {
    const allowed = TASK_TRANSITIONS[from].join(', ');
    return {
      ok: false,
      reason: 'illegal',
      message: `A task that is ${from} cannot become ${to}; it can become: ${allowed}`,
    };
  }
  const closesOrReopens = to === 'completed' || from === 'completed';
  if (closesOrReopens && !party.isAssigner && !party.isAdmin) {
    return {
      ok: false,
      reason: 'forbidden',
      message: 'Only the person who assigned the task, or an Admin, can complete or reopen it',
    };
  }
  return { ok: true };
}
