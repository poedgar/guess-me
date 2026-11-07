/**
 * Earthy palette taken from the "У дзеркалі" logo (cream, olive, forest green,
 * browns). The built-in colour scales the components use are remapped to warm
 * equivalents so every existing `gray-*`, `blue-*`, … class follows the theme.
 */
const sand = { // replaces cool gray
  50: '#FBF7EE', 100: '#F4EDDC', 200: '#E8DCC0', 300: '#D6C59F', 400: '#B3A07C',
  500: '#8C7B5C', 600: '#6B5B42', 700: '#4E4230', 800: '#2E2A20', 900: '#1C1A14', 950: '#13110D',
};
const forest = { // replaces blue
  50: '#EEF3EF', 100: '#D6E2D9', 200: '#AFC5B5', 300: '#85A68E', 400: '#5E8A6B',
  500: '#47705A', 600: '#3C5946', 700: '#314A3A', 800: '#263A2E', 900: '#1C2B22', 950: '#121C16',
};
const olive = { // replaces green
  50: '#F4F5E6', 100: '#E6E9C6', 200: '#CED497', 300: '#B2BB66', 400: '#939E42',
  500: '#7A8433', 600: '#6E762C', 700: '#565C23', 800: '#40451B', 900: '#2C2F13', 950: '#1B1D0B',
};
const brown = { // replaces purple
  50: '#F7F0E6', 100: '#EADCC5', 200: '#D9BF98', 300: '#C29E6C', 400: '#A9804A',
  500: '#8F6835', 600: '#7C5725', 700: '#64461E', 800: '#4C3517', 900: '#352510', 950: '#22180A',
};
const brick = { // replaces red
  50: '#FBEFEA', 100: '#F4D6CB', 200: '#E8AC98', 300: '#D88066', 400: '#C35C40',
  500: '#A63D2A', 600: '#8E3222', 700: '#73281C', 800: '#591F16', 900: '#3F1610', 950: '#2A0E0A',
};
const burnt = { // replaces orange
  50: '#FBF1E6', 100: '#F5DCC0', 200: '#EBBE8A', 300: '#DE9C57', 400: '#CF7F35',
  500: '#C0702A', 600: '#A55B20', 700: '#84481A', 800: '#643614', 900: '#44250E', 950: '#2C1808',
};
const mustard = { // replaces yellow
  50: '#FBF6E3', 100: '#F5E9BC', 200: '#EBD68A', 300: '#DFC15C', 400: '#D1AC3A',
  500: '#B8952C', 600: '#967824', 700: '#745C1C', 800: '#534215', 900: '#372C0E', 950: '#231C08',
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        gray: sand,
        blue: forest,
        green: olive,
        purple: brown,
        red: brick,
        orange: burnt,
        yellow: mustard,
        // Cards keep "bg-white" but read as warm paper on the cream page.
        white: '#FFFCF5',
        // Page background behind the cards.
        cream: '#F7EFDC',
        'game-green': '#6E762C',
        'game-blue': '#3C5946',
        'game-purple': '#7C5725',
        'game-orange': '#C0702A',
        'game-danger': '#A63D2A',
        'game-gold': '#C9A227',
        'game-neutral': '#8C8270',
      },
      fontFamily: {
        philosopher: ['Philosopher', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
