import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50: '#fefdfb',
          100: '#fdf9f0',
          200: '#faf0d8',
          300: '#f5e3b8',
          400: '#edd196',
          500: '#e2bc72',
          600: '#c9a05a',
          700: '#a88044',
          800: '#876538',
          900: '#6e5130',
          950: '#3d2b17',
        },
        leather: {
          50: '#faf6f2',
          100: '#f0e6da',
          200: '#e0cbb4',
          300: '#cdaa87',
          400: '#b98a61',
          500: '#a87348',
          600: '#8e5d3b',
          700: '#734933',
          800: '#603d2e',
          900: '#4a3127',
          950: '#2d1a14',
        },
        gold: {
          50: '#fffceb',
          100: '#fff6c6',
          200: '#ffec88',
          300: '#ffdd4b',
          400: '#ffcc20',
          500: '#f0aa07',
          600: '#cc8102',
          700: '#a35b06',
          800: '#86460d',
          900: '#72390f',
          950: '#421d03',
        },
        crimson: {
          50: '#fff1f1',
          100: '#ffdfe0',
          200: '#ffc4c6',
          300: '#ff9a9e',
          400: '#ff5f66',
          500: '#ff2d36',
          600: '#ed1520',
          700: '#c70d17',
          800: '#a41017',
          900: '#87141a',
          950: '#4a0508',
        },
        emerald: {
          50: '#edfcf2',
          100: '#d3f8df',
          200: '#abefc4',
          300: '#74e2a3',
          400: '#3ccb7e',
          500: '#17b164',
          600: '#0b8f50',
          700: '#097241',
          800: '#0b5a36',
          900: '#0a4a2e',
          950: '#04291a',
        },
        charcoal: {
          50: '#f6f6f7',
          100: '#e2e3e5',
          200: '#c4c6cb',
          300: '#a0a3aa',
          400: '#7c7f88',
          500: '#62656e',
          600: '#4e5058',
          700: '#404249',
          800: '#37383d',
          900: '#2c2d31',
          950: '#1a1b1e',
        },
      },
      fontFamily: {
        heading: ['Cinzel', 'Playfair Display', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        panel: '0.75rem',
        card: '0.5rem',
      },
      boxShadow: {
        card: '0 2px 8px 0 rgba(0, 0, 0, 0.25), 0 1px 3px 0 rgba(0, 0, 0, 0.15)',
        panel: '0 4px 16px 0 rgba(0, 0, 0, 0.35), 0 2px 6px 0 rgba(0, 0, 0, 0.2)',
        glow: '0 0 12px rgba(240, 170, 7, 0.3)',
      },
      keyframes: {
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-in-right': 'slide-in-right 0.3s ease-out',
      },
    },
  },
  plugins: [forms],
};

export default config;
