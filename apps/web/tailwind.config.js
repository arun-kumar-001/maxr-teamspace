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
        brand: { red: v('brand-red') },
        bg: v('bg'),
        surface: { DEFAULT: v('surface'), raised: v('surface-raised'), muted: v('surface-muted') },
        track: v('track'),
        text: v('text'),
        'text-muted': v('text-muted'),
        'text-subtle': v('text-subtle'),
        border: { DEFAULT: v('border'), strong: v('border-strong') },
        overlay: v('overlay'),
        sidebar: {
          DEFAULT: v('sidebar-bg'),
          raised: v('sidebar-raised'),
          border: v('sidebar-border'),
          text: v('sidebar-text'),
          strong: v('sidebar-text-strong'),
          muted: v('sidebar-muted'),
        },
        positive: { soft: v('positive-soft'), ink: v('positive-ink') },
        negative: { soft: v('negative-soft'), ink: v('negative-ink') },
        tile: {
          peach: v('tile-peach'),
          yellow: v('tile-yellow'),
          blue: v('tile-blue'),
          green: v('tile-green'),
        },
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
        tile: v('radius-tile'),
        card: v('radius-card'),
        segment: v('radius-segment'),
      },
      boxShadow: {
        card: v('shadow-card'),
        raised: v('shadow-raised'),
        primary: v('shadow-primary'),
      },
      width: { sidebar: v('sidebar-width'), rail: v('sidebar-rail-width') },
      spacing: { shell: v('shell-gap') },
      fontSize: { greeting: [v('font-greeting'), { lineHeight: '1.1', letterSpacing: '-0.02em' }] },
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
