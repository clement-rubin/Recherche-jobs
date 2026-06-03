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
        background: '#08090e',
        surface: '#0c0d16',
        card: '#101220',
        'card-hover': '#141729',
        border: '#1a1d32',
        'border-light': '#242847',
        accent: '#7c3aed',
        'accent-light': '#9f67ff',
        success: '#10b981',
        warning: '#f59e0b',
        danger: '#f43f5e',
        foreground: '#e8eaf5',
        'foreground-dim': '#9ca3c8',
        muted: '#4b5175',
        'muted-light': '#7880a0',
      },
      fontFamily: {
        sans: ['Outfit', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'glow-sm': '0 0 12px rgba(124, 58, 237, 0.2)',
        'glow': '0 0 24px rgba(124, 58, 237, 0.3)',
        'glow-lg': '0 0 40px rgba(124, 58, 237, 0.35)',
        card: '0 4px 24px rgba(0, 0, 0, 0.5)',
      },
    },
  },
  plugins: [],
}

export default config
