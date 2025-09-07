/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",   // ✅ since you’re using plain JS + React
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
