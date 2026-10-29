/**
 * WCAG 2.1 AA Relative Luminance & Contrast Ratio Calculator
 * Reference: W3C Web Content Accessibility Guidelines (WCAG) 2.1
 */

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleanHex = hex.replace('#', '');
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
}

function sRgbToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/**
 * Calculates relative luminance (0 for darkest black, 1 for lightest white)
 */
export function getRelativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const rLinear = sRgbToLinear(r);
  const gLinear = sRgbToLinear(g);
  const bLinear = sRgbToLinear(b);
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculates contrast ratio between two hex colors: (L1 + 0.05) / (L2 + 0.05)
 * Returns ratio e.g. 4.5 for 4.5:1
 */
export function getContrastRatio(foregroundHex: string, backgroundHex: string): number {
  const l1 = getRelativeLuminance(foregroundHex);
  const l2 = getRelativeLuminance(backgroundHex);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Number(((lighter + 0.05) / (darker + 0.05)).toFixed(2));
}

/**
 * Validates whether contrast meets WCAG 2.1 AA standards:
 * - normalText: minimum 4.5:1
 * - largeText: minimum 3.0:1
 */
export function meetsWcagAA(
  foregroundHex: string,
  backgroundHex: string,
  type: 'normalText' | 'largeText' = 'normalText'
): boolean {
  const ratio = getContrastRatio(foregroundHex, backgroundHex);
  const required = type === 'normalText' ? 4.5 : 3.0;
  return ratio >= required;
}

