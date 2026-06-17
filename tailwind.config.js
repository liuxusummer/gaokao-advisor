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
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
          dark: 'var(--color-primary-dark)',
          bg: 'var(--color-primary-bg)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
        info: 'var(--color-info)',
        tier: {
          rush: '#ef4444',
          stable: '#16a34a',
          safe: '#3b82f6',
        },
        'text-primary': 'var(--text-primary)',
        'text-body': 'var(--text-body)',
        'text-secondary': 'var(--text-secondary)',
        'text-placeholder': 'var(--text-placeholder)',
        'border-color': 'var(--border-color)',
        'bg-page': 'var(--bg-page)',
        'bg-card': 'var(--bg-card)',
        'bg-hover': 'var(--bg-hover)',
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
