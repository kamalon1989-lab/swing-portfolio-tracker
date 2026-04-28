import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        card: 'rgb(var(--card) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        sub: 'rgb(var(--sub) / <alpha-value>)',
        brand: {
          DEFAULT: '#2563eb',
          dark: '#3b82f6',
        },
        gain: '#16a34a',
        loss: '#dc2626',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'Segoe UI',
          'Apple SD Gothic Neo', 'Noto Sans KR', 'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};

export default config;
