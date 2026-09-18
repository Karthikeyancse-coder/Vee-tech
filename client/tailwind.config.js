/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          950: '#060709',
          900: '#0a0d14',
          850: '#111520',
          800: '#171c2b',
          700: '#23293d',
          600: '#333b54'
        },
        crisis: {
          red: '#ef4444',
          glow: '#dc2626',
          dark: '#7f1d1d'
        },
        tactical: {
          amber: '#f59e0b',
          emerald: '#10b981',
          cyan: '#06b6d4',
          blue: '#3b82f6',
          purple: '#8b5cf6'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'radarSweep 4s linear infinite',
      },
      keyframes: {
        radarSweep: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      }
    },
  },
  plugins: [],
}
