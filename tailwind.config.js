/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'] },
      colors: {
        brand: { 950: '#082a19', 900: '#0b3a23', 800: '#0f4a2d', 700: '#145f39', 600: '#1a7746', 500: '#2a8f58', 100: '#dcefe3', 50: '#eef7f1' },
        gold: { 700: '#8f6a10', 600: '#b38612', 500: '#c99a1e', 100: '#f7edd1' },
        plum: { 700: '#4f3596', 600: '#6447b5', 100: '#ece7f8' },
        navy: { 700: '#173c78', 600: '#1f4e9a', 100: '#e3ebf8' },
        ink: { 900: '#1c2420', 700: '#3b4741', 500: '#66736c', 300: '#c9d1cc', 200: '#e1e6e3', 100: '#eef1ef', 50: '#f6f8f7' },
      },
      boxShadow: { card: '0 1px 2px rgba(16,40,28,.06), 0 1px 1px rgba(16,40,28,.04)', lift: '0 6px 18px rgba(16,40,28,.10)' },
    },
  },
  plugins: [],
};
