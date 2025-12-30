/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        numa: {
          bg: '#0f172a',      // Bleu nuit
          text: '#f8fafc',    // Blanc cassé
          primary: '#38bdf8', // Cyan
        }
      }
    },
  },
  plugins: [],
}