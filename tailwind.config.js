/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        yt: { red: '#ff0000', bg: '#0f0f0f', surface: '#1f1f1f', border: '#303030', text: '#f1f1f1', muted: '#aaaaaa' },
      },
    },
  },
  plugins: [],
};
