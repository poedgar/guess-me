/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'game-green': '#34C759',
        'game-blue': '#007AFF',
        'game-purple': '#AF52DE',
        'game-orange': '#FF9500',
        'game-danger': '#FF3B30',
        'game-gold': '#FFD700',
        'game-neutral': '#8E8E93',
      },
      fontFamily: {
        philosopher: ['Philosopher', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
