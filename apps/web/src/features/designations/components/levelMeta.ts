export interface LevelTierMeta {
  level: number;
  label: string;
  shortLabel: string;
  pillClass: string;
  barClass: string;
}

export const CAREER_LEVEL_BANDS: readonly LevelTierMeta[] = [
  {
    level: 1,
    label: 'L1 · Associate',
    shortLabel: 'Associate',
    pillClass: 'bg-surface-muted text-text-muted border-border',
    barClass: 'bg-text-subtle',
  },
  {
    level: 2,
    label: 'L2 · Mid / Specialist',
    shortLabel: 'Specialist',
    pillClass: 'bg-sky-50 text-sky-800 border-sky-200',
    barClass: 'bg-sky-600',
  },
  {
    level: 3,
    label: 'L3 · Senior / Lead',
    shortLabel: 'Senior Lead',
    pillClass: 'bg-purple-50 text-purple-800 border-purple-200',
    barClass: 'bg-purple-600',
  },
  {
    level: 4,
    label: 'L4 · Director / Exec',
    shortLabel: 'Director',
    pillClass: 'bg-primary-soft text-primary-deep border-primary-strong/30',
    barClass: 'bg-primary-strong',
  },
];

export function getLevelTierMeta(level: number): LevelTierMeta {
  const clamped = Math.min(4, Math.max(1, level));
  return CAREER_LEVEL_BANDS.find((b) => b.level === clamped) ?? CAREER_LEVEL_BANDS[1]!;
}
