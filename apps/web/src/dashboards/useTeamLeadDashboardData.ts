import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchApprovals } from '../features/approvals/api/approvals';
import type { Approval } from '../features/approvals/types';
import { fetchTeamAttendance } from '../features/attendance/api/attendance';
import type { AttendanceRecord } from '../features/attendance/types';
import { fetchEmployeeDirectory } from '../features/employees/api/employees';
import type { EmployeeDirectoryItem } from '../features/employees/types';
import { fetchMyTasks, fetchTeamTasks } from '../features/tasks/api/tasksApi';
import type { Task } from '../features/tasks/types';
import { isForbiddenError, localDateString } from './team-lead-metrics';

const PAGE_SIZE = 100;

/** What one card knows about its data: still loading, loaded, or failed (forbidden is its own case). */
export type Resource<T> =
  { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; forbidden: boolean };

/** The rows of the first page, plus how many exist in total. */
export interface Counted<T> {
  items: T[];
  total: number;
}

export interface TeamLeadData {
  team: Resource<Counted<EmployeeDirectoryItem>>;
  myTasks: Resource<Counted<Task>>;
  teamTasks: Resource<Counted<Task>>;
  approvals: Resource<Counted<Approval>>;
  attendance: Resource<Counted<AttendanceRecord>>;
}

type Key = keyof TeamLeadData;

const ALL_KEYS: readonly Key[] = ['team', 'myTasks', 'teamTasks', 'approvals', 'attendance'];
// Keys that change while the page is open (a task is updated, someone checks in).
const LIVE_KEYS: readonly Key[] = ['myTasks', 'teamTasks', 'approvals', 'attendance'];

const LOADING = { status: 'loading' } as const;

async function toResource<T>(
  run: () => Promise<{ data?: T[]; meta?: { total?: number } }>,
): Promise<Resource<Counted<T>>> {
  try {
    const res = await run();
    const items = res.data ?? [];
    return { status: 'ready', data: { items, total: res.meta?.total ?? items.length } };
  } catch (error) {
    return { status: 'error', forbidden: isForbiddenError(error) };
  }
}

// The API limits every list to the caller's own team, so none of these ask for a team id.
const RUNNERS: { [K in Key]: () => Promise<TeamLeadData[K]> } = {
  team: () => toResource(() => fetchEmployeeDirectory({ pageSize: PAGE_SIZE })),
  myTasks: () => toResource(() => fetchMyTasks({ pageSize: PAGE_SIZE })),
  teamTasks: () => toResource(() => fetchTeamTasks({ pageSize: PAGE_SIZE })),
  approvals: () => toResource(() => fetchApprovals({ status: 'pending', pageSize: PAGE_SIZE })),
  attendance: () => {
    const today = localDateString();
    return toResource(() =>
      fetchTeamAttendance({ startDate: today, endDate: today, pageSize: PAGE_SIZE }),
    );
  },
};

export function useTeamLeadDashboardData() {
  const [data, setData] = useState<TeamLeadData>({
    team: LOADING,
    myTasks: LOADING,
    teamTasks: LOADING,
    approvals: LOADING,
    attendance: LOADING,
  });
  const mounted = useRef(true);

  const reload = useCallback((keys: readonly Key[]) => {
    for (const key of keys) {
      // A retry after a failure shows the spinner again; a quiet refresh keeps what is on screen.
      setData((current) =>
        current[key].status === 'ready' ? current : { ...current, [key]: LOADING },
      );
      void RUNNERS[key]().then((result) => {
        if (!mounted.current) return;
        setData((current) =>
          // A failed refresh must not wipe numbers that loaded fine a moment ago.
          result.status === 'error' && current[key].status === 'ready'
            ? current
            : { ...current, [key]: result },
        );
      });
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    reload(ALL_KEYS);

    const refreshLive = () => reload(LIVE_KEYS);
    window.addEventListener('maxr:task-updated', refreshLive);
    window.addEventListener('maxr:attendance-updated', refreshLive);
    // Another tab of this app changed something.
    window.addEventListener('storage', refreshLive);
    return () => {
      mounted.current = false;
      window.removeEventListener('maxr:task-updated', refreshLive);
      window.removeEventListener('maxr:attendance-updated', refreshLive);
      window.removeEventListener('storage', refreshLive);
    };
  }, [reload]);

  const retry = useCallback((...keys: Key[]) => reload(keys), [reload]);

  return { ...data, retry };
}
