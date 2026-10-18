/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#050505',
        surface: {
          DEFAULT: '#0a0a0a',
          card: '#0e0e0e',
          subtle: '#141414',
          border: '#1f1f1f',
          strong: '#2d2d2d',
        },
        ivory: {
          DEFAULT: '#f4f4e8',
          muted: '#b8b8a8',
          faint: '#6e6e65',
        },
        acid: {
          DEFAULT: '#d1ff00',
          hover: '#e5ff4d',
          faint: 'rgba(209, 255, 0, 0.08)',
          border: 'rgba(209, 255, 0, 0.25)',
        },
      },
      fontFamily: {
        display: ['"TASA Orbiter"', 'Syne', 'sans-serif'],
        mono: ['"Geist Mono"', '"Roboto Mono"', 'monospace'],
        body: ['Inter', 'sans-serif'],
      },
      letterSpacing: {
        widest: '0.15em',
        tightest: '-0.04em',
      },
    },
  },
  plugins: [],
}
