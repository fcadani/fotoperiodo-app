/** @type {import('tailwindcss').Config} */
export default {
  content: [
    // La ruta de tu index.html
    "./index.html", 
    // RUTAS CRÍTICAS: Asegúrate de que esto cubra todos tus archivos .js, .jsx y .css
    "./src/**/*.{js,ts,jsx,tsx}", 
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}