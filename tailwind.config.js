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
          bg: '#1e1b4b',      // Indigo très sombre (plus chaud que le noir)
          surface: '#312e81', // Indigo moyen pour les cartes
          text: '#e0e7ff',    // Blanc cassé bleuté (doux pour les yeux)
          primary: '#c084fc', // Lavande douce (pour l'action)
          secondary: '#2dd4bf', // Teal apaisant (pour la validation)
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Police plus ronde et humaine
      }
    },
  },
  plugins: [],
}