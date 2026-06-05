/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Manrope', 'ui-sans-serif', 'system-ui'],
        serif: ['Newsreader', 'ui-serif', 'Georgia', 'serif'],
      },
      colors: {
        canvas: 'rgb(var(--canvas) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        elevated: 'rgb(var(--elevated) / <alpha-value>)',
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          2: 'rgb(var(--ink-2) / <alpha-value>)',
          3: 'rgb(var(--ink-3) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--line) / <alpha-value>)',
          2: 'rgb(var(--line-2) / <alpha-value>)',
        },
        pri: {
          critical: 'rgb(var(--pri-critical) / <alpha-value>)',
          'critical-bg': 'rgb(var(--pri-critical-bg) / <alpha-value>)',
          'critical-bd': 'rgb(var(--pri-critical-bd) / <alpha-value>)',
          strategic: 'rgb(var(--pri-strategic) / <alpha-value>)',
          'strategic-bg': 'rgb(var(--pri-strategic-bg) / <alpha-value>)',
          'strategic-bd': 'rgb(var(--pri-strategic-bd) / <alpha-value>)',
          interruptive: 'rgb(var(--pri-interruptive) / <alpha-value>)',
          'interruptive-bg': 'rgb(var(--pri-interruptive-bg) / <alpha-value>)',
          'interruptive-bd': 'rgb(var(--pri-interruptive-bd) / <alpha-value>)',
          backlog: 'rgb(var(--pri-backlog) / <alpha-value>)',
          'backlog-bg': 'rgb(var(--pri-backlog-bg) / <alpha-value>)',
          'backlog-bd': 'rgb(var(--pri-backlog-bd) / <alpha-value>)',
        },
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.6rem',
      },
      letterSpacing: {
        overline: '0.22em',
      },
      transitionTimingFunction: {
        calm: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 500ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'rise-in': 'riseIn 600ms cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        riseIn: {
          '0%': { opacity: 0, transform: 'translateY(8px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
