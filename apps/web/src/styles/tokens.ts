/**
 * Design tokens for MAXR Teamspace: MaxR Flow colours and fonts in the reference dashboard layout.
 * Mirrors src/styles/tokens.css (the CSS variables are the source the UI uses);
 * this copy exists for tests, charts and anything that needs the raw values in TypeScript.
 * Spec: docs/design/DESIGN.md and AGENTS.md section 8. Never hardcode hex values in components.
 */

export const COLOR_TOKENS = {
  // Brand (MaxR Flow)
  primary: '#46C7B8', // indicators, dots, bars, progress, logo tile (never text)
  primaryStrong: '#0D9488', // icons, focus ring
  primaryDeep: '#0F766E', // solid primary buttons with white text
  primaryDeeper: '#115E59', // primary button hover
  primaryInk: '#0F766E', // teal text and links
  primarySoft: '#E9F8F6',
  primarySoftBorder: '#CCEFEB',
  brandRed: '#E5322D', // logo "R" only

  // Page and surfaces
  bg: '#EEF2F1',
  surface: '#FBFCFC',
  surfaceRaised: '#FFFFFF',
  surfaceMuted: '#F2F5F4',
  track: '#E8EEEC',
  border: '#E3E9E7',
  borderStrong: '#D3DCD9',
  text: '#13201E',
  textMuted: '#4F5C5A',
  textSubtle: '#5F6C6A',

  // Floating dark sidebar
  sidebarBg: '#0E2826',
  sidebarRaised: '#1B3532',
  sidebarBorder: '#26413E',
  sidebarText: '#D5E2DF',
  sidebarTextStrong: '#F2F7F6',
  sidebarMuted: '#8AA29D',
  sidebarAttention: '#F5B73D',

  // Change indicators
  positiveSoft: '#DCF2EA',
  positiveInk: '#047857',
  negativeSoft: '#F9E3E1',
  negativeInk: '#B42318',

  // Pastel attention tiles
  tilePeach: '#FFE0D4',
  tileYellow: '#FBECC6',
  tileBlue: '#DCEBFA',
  tileGreen: '#D8F1E3',

  // Status semantics
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

/** Categorical palette for pipelines and charts, in display order. `fill` for bars, `ink` for numbers. */
export const CHART_TOKENS = [
  { name: 'blue', fill: '#3B82F6', ink: '#2563EB' },
  { name: 'teal', fill: '#46C7B8', ink: '#0F766E' },
  { name: 'pink', fill: '#EC4899', ink: '#DB2777' },
  { name: 'purple', fill: '#8B5CF6', ink: '#7C3AED' },
  { name: 'amber', fill: '#F59E0B', ink: '#B45309' },
  { name: 'green', fill: '#10B981', ink: '#047857' },
  { name: 'red', fill: '#EF4444', ink: '#DC2626' },
] as const;

export const SPACING_TOKENS = {
  0: '0px',
  1: '0.25rem', // 4px
  2: '0.5rem', // 8px (base unit)
  3: '0.75rem', // 12px
  4: '1rem', // 16px
  5: '1.25rem', // 20px
  6: '1.5rem', // 24px
  8: '2rem', // 32px
  10: '2.5rem', // 40px
  12: '3rem', // 48px
  16: '4rem', // 64px
} as const;

export const RADIUS_TOKENS = {
  none: '0px',
  sm: '4px',
  input: '12px', // buttons, inputs, nav items, icon buttons
  segment: '10px', // segmented control items
  tile: '16px', // tiles inside cards, metric strip items
  card: '24px', // cards, sidebar, modals
  full: '9999px',
} as const;

export const FLUID_TYPOGRAPHY = {
  // Fluid font scaling via clamp(min, preferred, max)
  xs: 'clamp(0.75rem, 0.7rem + 0.25vw, 0.8125rem)', // 12px - 13px
  sm: 'clamp(0.8125rem, 0.775rem + 0.25vw, 0.875rem)', // 13px - 14px
  base: 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)', // 14px - 16px
  lg: 'clamp(1rem, 0.925rem + 0.4vw, 1.125rem)', // 16px - 18px
  xl: 'clamp(1.125rem, 1rem + 0.6vw, 1.35rem)', // 18px - 21.6px
  '2xl': 'clamp(1.35rem, 1.2rem + 0.8vw, 1.75rem)', // 21.6px - 28px
  '3xl': 'clamp(1.75rem, 1.5rem + 1.2vw, 2.25rem)', // 28px - 36px
} as const;

export const CONTAINER_MAX_WIDTHS = {
  prose: '70ch', // Readable text/forms capped (≈70ch / ≈960px) per §8
  form: '960px',
  dashboard: '1536px',
} as const;
