/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['Manrope', 'system-ui', 'sans-serif'] },
      colors: {
        ink: '#12183A',
        brand: { 50: '#EEF0FF', 100: '#DEE2FF', 200: '#C2C8FF', 500: '#5B5BF0', 600: '#4A47DB', 700: '#3B37B8' },
        sun: { 50: '#FFF8E1', 100: '#FFEDB0', 500: '#F5A524', 600: '#D98A0B' },
        mint: { 50: '#E6FAF3', 500: '#1FB58A', 600: '#128F6B' },
      },
      keyframes: { pop: { '0%': { transform: 'scale(.9)', opacity: 0 }, '100%': { transform: 'scale(1)', opacity: 1 } } },
      animation: { pop: 'pop .18s ease-out' },
    },
  },
  plugins: [],
}
