/** @type {import('tailwindcss').Config} */
// Every colour comes from a CSS variable in src/styles/tokens.css (single source).
const v = (name) => `var(--${name})`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    screens: {
      xs: '360px',
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
      '3xl': '1920px',
      '4xl': '2560px',
    },
    extend: {
      colors: {
        primary: {
          DEFAULT: v('primary'),
          strong: v('primary-strong'),
          deep: v('primary-deep'),
          deeper: v('primary-deeper'),
          ink: v('primary-ink'),
          soft: v('primary-soft'),
          'soft-border': v('primary-soft-border'),
        },
        hero: { from: v('hero-from'), to: v('hero-to'), border: v('hero-border') },
        brand: { red: v('brand-red') },
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), muted: v('surface-muted') },
        text: v('text'),
        'text-muted': v('text-muted'),
        'text-subtle': v('text-subtle'),
        border: { DEFAULT: v('border'), strong: v('border-strong') },
        overlay: v('overlay'),
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
        info: v('info'),
        chart: Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, v(`chart-${n}`)])),
        'chart-ink': Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((n) => [n, v(`chart-ink-${n}`)])),
        // Legacy: remove once the app shell (#12) uses the light sidebar.
        navy: { 950: v('navy-950'), 900: v('navy-900'), 800: v('navy-800') },
      },
      borderRadius: {
        input: v('radius-input'),
        card: v('radius-card'),
        panel: v('radius-panel'),
      },
      boxShadow: {
        card: v('shadow-card'),
        raised: v('shadow-raised'),
      },
      maxWidth: {
        prose: '70ch', // AGENTS.md §8: readable text/forms capped (≈70ch / ≈960px)
        form: '960px',
        dashboard: '1536px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: [
          'Outfit',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
