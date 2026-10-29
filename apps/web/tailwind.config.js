/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
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
        navy: {
          950: '#0A1429', // App shell / dark surfaces, persistent sidebar
          900: '#0E2042', // Dark panels, section headers
          800: '#1E2F50', // Cards on dark, borders
        },
        teal: {
          500: '#14B8A6', // Primary buttons, active nav, focus ring
          600: '#0D9488', // Primary hover / pressed
        },
        brand: {
          red: '#E5322D', // Logo mark only
        },
        bg: 'var(--bg)',
        surface: {
          DEFAULT: 'var(--surface)',
          muted: '#F6F8FB',
        },
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        border: 'var(--border)',
        success: '#16A34A',
        warning: '#D97706',
        danger: '#DC2626',
        info: '#2563EB',
        status: {
          success: '#16A34A',
          warning: '#D97706',
          danger: '#DC2626',
          info: '#2563EB',
        },
      },
      borderRadius: {
        input: '6px', // AGENTS.md §8: 6px inputs
        card: '8px', // AGENTS.md §8: 8px cards
      },
      maxWidth: {
        prose: '70ch', // AGENTS.md §8: Readable text/forms capped (≈70ch / ≈960px)
        form: '960px',
        dashboard: '1536px',
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
