
/** @type {import('tailwindcss').Config} */
// Tailwind v4 JS config (consumed via @config directive in src/app/globals.css).
// Migrating this to a CSS-first @theme block was evaluated 2026-05-26 — would
// require 101 sportsBar* sed replacements (camelCase → kebab-case in v4's
// auto-naming convention) with no functional benefit. v4 supports JS config
// indefinitely; keeping it.
//
// Pruned 2026-05-26 (v2.54.42): removed `accent` color scale (0 usages
// across apps/web/src) and the `accent-gradient` backgroundImage. The
// remaining primary/sportsBar/sports-gradient/primary-gradient are all
// used in production components.
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Sports Bar Dark Blue Theme
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554'
        },
        // Dark Blue Background Variants (101 usages across apps/web/src)
        sportsBar: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617'
        }
      },
      backgroundImage: {
        'sports-gradient': 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
        'primary-gradient': 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)'
      }
    },
  },
  plugins: [],
}
