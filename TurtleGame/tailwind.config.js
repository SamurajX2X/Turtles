/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,html}"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#2c7873',
        'primary-hover': '#1e5250',
        secondary: '#6fb98f',
        background: '#f7f9f9',
        text: '#2a2a2a',
        border: '#ddd',
        error: '#e74c3c',
        success: '#27ae60',
      }
    },
  },
  plugins: [],
}

