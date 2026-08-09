/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F4C3A',
          50: '#EDF7F2',
          100: '#D3EBDF',
          200: '#A7D7C1',
          300: '#76BF9E',
          400: '#44A378',
          500: '#1E7A57',
          600: '#17654A',
          700: '#0F4C3A',
          800: '#0A3A2D',
          900: '#062820',
          accent: '#C79A2D',
        },
        cream: 'var(--color-cream)',
        ink: 'var(--color-ink)',
        muted: 'var(--color-muted)',
        line: 'var(--color-line)',
        surface: 'var(--color-surface)',
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 40, 32, 0.06), 0 4px 16px rgba(16, 40, 32, 0.06)',
        lift: '0 8px 30px rgba(16, 40, 32, 0.14)',
      },
      borderRadius: {
        xl2: '1rem',
      },
    },
  },
  plugins: [],
}
