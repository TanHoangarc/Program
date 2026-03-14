/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        glass: {
          100: 'rgba(255, 255, 255, 0.1)',
          200: 'rgba(255, 255, 255, 0.2)',
          300: 'rgba(255, 255, 255, 0.3)',
          400: 'rgba(255, 255, 255, 0.4)',
          500: 'rgba(255, 255, 255, 0.5)',
          600: 'rgba(255, 255, 255, 0.6)',
          700: 'rgba(255, 255, 255, 0.7)',
          border: 'rgba(255, 255, 255, 0.5)',
        },
        brand: {
          DEFAULT: '#0f766e', // Teal 700
          light: '#2dd4bf', // Teal 400
          dark: '#111827', // Gray 900
          accent: '#f472b6', // Pink 400
        }
      },
    },
  },
  plugins: [],
}
