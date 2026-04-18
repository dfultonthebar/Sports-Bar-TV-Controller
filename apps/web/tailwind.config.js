
/** @type {import('tailwindcss').Config} */
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
        // Dark Blue Background Variants
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
        },
        // Accent colors for sports themes
        accent: {
          green: '#10b981',
          orange: '#f59e0b',
          red: '#ef4444',
          purple: '#8b5cf6'
        }
      },
      backgroundImage: {
        'sports-gradient': 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
        'primary-gradient': 'linear-gradient(135deg, #1e40af 0%, #2563eb 50%, #3b82f6 100%)',
        'accent-gradient': 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
      }
    },
  },
  plugins: [],
}
