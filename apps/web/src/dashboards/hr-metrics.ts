export interface HrEmployee {
  id: string;
  joiningDate: string;
  departmentName: string;
}

export interface HrAttendanceRecord {
  employeeId: string;
  workDate: string;
  checkInTime: string | null;
  status?: string;
}

/** Employees who joined in the same month as `today` (YYYY-MM-DD). */
export function joinedThisMonth(employees: readonly HrEmployee[], today: string): number {
  const month = today.slice(0, 7);
  return employees.filter((e) => e.joiningDate.slice(0, 7) === month).length;
}

/** The people with a check-in on `date`, each counted once. */
export function presentOn(records: readonly HrAttendanceRecord[], date: string): Set<string> {
  return new Set(
    records.filter((r) => r.workDate === date && r.checkInTime).map((r) => r.employeeId),
  );
}

export interface DayTrend {
  date: string;
  /** Mon, Tue ... */
  label: string;
  present: number;
  /** Whole percent of the headcount; null when there is no headcount. */
  rate: number | null;
}

const LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** One entry per day from Monday of the week of `today` up to and including `today`. */
export function weekTrend(
  records: readonly HrAttendanceRecord[],
  headcount: number,
  today: string,
): DayTrend[] {
  const end = new Date(`${today}T00:00:00Z`);
  const daysSinceMonday = (end.getUTCDay() + 6) % 7;
  const trend: DayTrend[] = [];
  for (let i = daysSinceMonday; i >= 0; i -= 1) {
    const day = new Date(end.getTime() - i * 24 * 60 * 60 * 1000);
    const date = day.toISOString().slice(0, 10);
    const present = presentOn(records, date).size;
    trend.push({
      date,
      label: LABELS[day.getUTCDay()] as string,
      present,
      rate: headcount > 0 ? Math.round((present / headcount) * 100) : null,
    });
  }
  return trend;
}

export interface DepartmentRow {
  name: string;
  headcount: number;
  /** Whole percent of all the listed employees. */
  share: number;
  presentToday: number;
}

/** Headcount per department, biggest first, with how many of them checked in today. */
export function departmentBreakdown(
  employees: readonly HrEmployee[],
  presentToday: ReadonlySet<string>,
): DepartmentRow[] {
  const byDepartment = new Map<string, { headcount: number; present: number }>();
  for (const e of employees) {
    const row = byDepartment.get(e.departmentName) ?? { headcount: 0, present: 0 };
    row.headcount += 1;
    if (presentToday.has(e.id)) row.present += 1;
    byDepartment.set(e.departmentName, row);
  }
  return [...byDepartment.entries()]
    .map(([name, row]) => ({
      name,
      headcount: row.headcount,
      share: employees.length > 0 ? Math.round((row.headcount / employees.length) * 100) : 0,
      presentToday: row.present,
    }))
    .sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name));
}
