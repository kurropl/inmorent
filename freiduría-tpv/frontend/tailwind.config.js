/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#f97316',
          dark: '#1c1917',
          surface: '#292524',
          border: '#44403c',
        }
      }
    },
  },
  plugins: [],
}
