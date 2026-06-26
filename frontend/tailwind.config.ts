import type { Config } from 'tailwindcss';
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        syne: ['Roboto', 'sans-serif'],
        dm: ['DM Sans', 'sans-serif'],
        mono: ['Roboto Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        accent: '#00e5a0',
        'accent-dim': 'rgba(0,229,160,0.15)',
        gold: '#f0a500',
        danger: '#ff4f6a',
        'bg-primary': '#0a0d12',
        'bg-secondary': '#0f1318',
        'bg-card': '#13181f',
        'bg-elevated': '#1a2030',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-up': 'slideUp 0.4s cubic-bezier(0.22,1,0.36,1)',
        'spin-slow': 'spin 1.5s linear infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { transform: 'translateY(20px)', opacity: '0' }, to: { transform: 'translateY(0)', opacity: '1' } },
      },
    },
  },
  plugins: [],
};

export default config;
