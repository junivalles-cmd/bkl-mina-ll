/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: { 50: '#eef4fb', 100: '#d6e4f3', 600: '#1f4e79', 700: '#173d60', 900: '#0f2740' },
      },
    },
  },
  plugins: [],
};
