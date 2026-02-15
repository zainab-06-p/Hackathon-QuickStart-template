/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0A0A0A',
        surface: '#111111',
        surfaceH: '#1A1A1A',
        
        primary: {
          DEFAULT: '#FFFFFF',
          muted: '#A1A1AA',
          dark: '#52525B',
        },
        
        accent: {
          DEFAULT: '#4F46E5',
          hover: '#0A0A0A',
          light: '#818CF8',
        },

        success: {
          DEFAULT: '#10B981',
          bg: 'rgba(16, 185, 129, 0.1)',
        },
        
        warning: {
          DEFAULT: '#F59E0B',
          bg: 'rgba(245, 158, 11, 0.1)',
        },

        border: {
          DEFAULT: '#27272A',
          light: '#3F3F46',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter Tight', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 40px -10px rgba(79, 70, 229, 0.2)',
      },
      animation: {
        'gradient-shift': 'gradient-shift 8s ease infinite',
      },
      keyframes: {
        'gradient-shift': {
          '0%, 100%': { 'background-position': '0% 50%' },
          '50%': { 'background-position': '100% 50%' },
        },
      },
      backgroundSize: {
        '300%': '300% 300%',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        impact: {
          'primary': '#4F46E5',
          'secondary': '#10B981',
          'accent': '#F59E0B',
          'neutral': '#111111',
          'base-100': '#0A0A0A',
          'base-content': '#FFFFFF',
          'info': '#3ABFF8',
          'success': '#10B981',
          'warning': '#FBBD23',
          'error': '#F87272',
        },
      },
    ],
  },
};
