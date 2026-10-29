/**
 * Design Tokens for MAXR Teamspace
 * Authoritative specification: AGENTS.md §8 (Design system and UI)
 *
 * Rules:
 * - Define once; never hardcode hex values in components.
 * - WCAG 2.1 AA compliant (minimum 4.5:1 text contrast).
 * - 8px spacing scale; radius 8px cards, 6px inputs.
 */

export const COLOR_TOKENS = {
  // Dark Shell & Sidebar
  navy950: '#0A1429',
  navy900: '#0E2042',
  navy800: '#1E2F50',

  // Primary Brand Accent
  teal500: '#14B8A6',
  teal600: '#0D9488',

  // Brand Logo Mark Only (Not for UI semantics)
  brandRed: '#E5322D',

  // Light Theme Surfaces & Text
  bg: '#F6F8FB',
  surface: '#FFFFFF',
  text: '#0F172A',
  textMuted: '#475569',
  border: '#E2E8F0',

  // Status Semantics
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#2563EB',
} as const;

export const SPACING_TOKENS = {
  0: '0px',
  1: '0.25rem', // 4px
  2: '0.5rem',  // 8px (base unit)
  3: '0.75rem', // 12px
  4: '1rem',    // 16px
  5: '1.25rem', // 20px
  6: '1.5rem',  // 24px
  8: '2rem',    // 32px
  10: '2.5rem', // 40px
  12: '3rem',   // 48px
  16: '4rem',   // 64px
} as const;

export const RADIUS_TOKENS = {
  none: '0px',
  sm: '4px',
  input: '6px', // 6px inputs per AGENTS.md §8
  card: '8px',  // 8px cards per AGENTS.md §8
  lg: '12px',
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
  prose: '70ch',        // Readable text/forms capped (≈70ch / ≈960px) per §8
  form: '960px',
  dashboard: '1536px',
} as const;

