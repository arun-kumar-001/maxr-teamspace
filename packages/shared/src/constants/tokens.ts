/**
 * Authoritative Design System Brand Tokens
 * Derived from AGENTS.md §8 (MAXR ONE Brand Specification)
 */
export const BRAND_TOKENS = {
  // Dark Shell Surfaces
  NAVY_950: '#0A1429', // App shell / dark surfaces, persistent sidebar
  NAVY_900: '#0E2042', // Dark panels, section headers
  NAVY_800: '#1E2F50', // Cards on dark, contrast borders

  // Primary Accent (Teal)
  TEAL_500: '#14B8A6', // Primary buttons, links, active nav item, focus ring
  TEAL_600: '#0D9488', // Primary hover / pressed state

  // Brand Mark (Logo mark only, not for semantic UI)
  BRAND_RED: '#E5322D',

  // Light Surfaces & Text
  BG_LIGHT: '#F6F8FB', // Light page background
  SURFACE: '#FFFFFF', // Cards, tables, forms
  TEXT_MAIN: '#0F172A', // Primary body text
  TEXT_MUTED: '#475569', // Secondary / descriptive text
  BORDER: '#E2E8F0', // Dividers, card borders, input borders

  // Status Semantics
  STATUS_SUCCESS: '#16A34A', // Approved, completed, present
  STATUS_WARNING: '#D97706', // Pending, in review, late
  STATUS_DANGER: '#DC2626', // Rejected, blocked, absent
  STATUS_INFO: '#2563EB', // Informational, applied
} as const;

/**
 * Responsive Breakpoints (AGENTS.md §8)
 * Mobile-first scale: 320px phone to 3440px ultrawide monitor
 */
export const BREAKPOINTS = {
  xs: 360,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
  '3xl': 1920,
  '4xl': 2560,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;
