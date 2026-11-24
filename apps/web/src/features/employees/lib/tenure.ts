const DAY_MS = 86_400_000;

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}

/**
 * How long someone has been with the company, for the directory ("9 days", "5 mo", "2 yr 10 mo").
 * A joining date in the future reads "Starts in N days". Comparison is by calendar day.
 */
export function formatTenure(
  joiningDate: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!joiningDate) return '—';
  const joined = new Date(joiningDate);
  if (Number.isNaN(joined.getTime())) return '—';

  const jy = joined.getUTCFullYear();
  const jm = joined.getUTCMonth();
  const jd = joined.getUTCDate();
  const ty = now.getFullYear();
  const tm = now.getMonth();
  const td = now.getDate();

  const days = Math.round((Date.UTC(ty, tm, td) - Date.UTC(jy, jm, jd)) / DAY_MS);
  if (days < 0) return `Starts in ${plural(-days, 'day')}`;
  if (days === 0) return 'Joined today';

  const months = (ty - jy) * 12 + (tm - jm) - (td < jd ? 1 : 0);
  if (months < 1) return plural(days, 'day');
  if (months < 12) return `${months} mo`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} yr` : `${years} yr ${rest} mo`;
}
