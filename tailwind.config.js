/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#059669',
          light: '#34d399',
          dark: '#065f46',
          bg: '#f0fdf4',
        },
        success: '#16a34a',
        warning: '#f59e0b',
        error: '#dc2626',
        info: '#3b82f6',
        tier: {
          rush: '#ef4444',
          stable: '#16a34a',
          safe: '#3b82f6',
        },
      },
      boxShadow: {
        'md': '0 4px 12px rgba(0,0,0,0.06)',
        'lg': '0 10px 24px rgba(0,0,0,0.1)',
        'primary': '0 4px 12px rgba(5,150,105,0.3)',
      },
      borderRadius: {
        'xl': '10px',
        '2xl': '12px',
      },
    },
  },
  plugins: [],
}
