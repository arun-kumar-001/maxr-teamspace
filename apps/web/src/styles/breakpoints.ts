/**
 * Responsive Breakpoints for MAXR Teamspace
 * Authoritative specification: AGENTS.md §8 (Responsive and fluid layout)
 *
 * Rules:
 * - Breakpoints live in tokens only; no per-component magic widths.
 * - One codebase works from small phone (320px) to ultrawide / 4K (3440px+).
 */

export const BREAKPOINTS = {
  xs: 360, // Small Phone (320px - 639px tier)
  sm: 640, // Large Phone / Phablet
  md: 768, // Tablet Portrait
  lg: 1024, // Tablet Landscape / Laptop (Persistent sidebar starts)
  xl: 1280, // Standard Desktop
  '2xl': 1536, // Large Monitor (Multi-column dashboards)
  '3xl': 1920, // Full HD Desktop
  '4xl': 2560, // Ultrawide / 4K (Grid expansion, capped text)
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * 9 Reference Viewports mandated for verification in AGENTS.md §8
 */
export const REFERENCE_VIEWPORTS = [
  { width: 360, height: 640, name: 'Small Phone' },
  { width: 390, height: 844, name: 'Modern Phone' },
  { width: 768, height: 1024, name: 'Tablet Portrait' },
  { width: 1024, height: 768, name: 'Tablet Landscape / Laptop' },
  { width: 1366, height: 768, name: 'Typical Laptop' },
  { width: 1440, height: 900, name: 'Desktop' },
  { width: 1920, height: 1080, name: 'FHD Monitor' },
  { width: 2560, height: 1440, name: 'QHD Large Monitor' },
  { width: 3440, height: 1440, name: 'Ultrawide Display' },
] as const;

export function getBreakpointForWidth(width: number): BreakpointKey {
  if (width < BREAKPOINTS.sm) return 'xs';
  if (width < BREAKPOINTS.md) return 'sm';
  if (width < BREAKPOINTS.lg) return 'md';
  if (width < BREAKPOINTS.xl) return 'lg';
  if (width < BREAKPOINTS['2xl']) return 'xl';
  if (width < BREAKPOINTS['3xl']) return '2xl';
  if (width < BREAKPOINTS['4xl']) return '3xl';
  return '4xl';
}
