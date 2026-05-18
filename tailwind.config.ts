import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        legacy: {
          bg: '#0a0a0f',
          surface: '#111118',
          border: '#1e1e2e',
          safe: '#0f172a',
          caution: '#f59e0b',
          risk: '#ef4444',
          critical: '#dc2626',
          text: '#e2e8f0',
          muted: '#64748b',
          accent: '#6366f1',
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'glow-red': 'glowRed 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        glowRed: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(239,68,68,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(239,68,68,0.7)' },
        },
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(rgba(99,102,241,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}
export default config
