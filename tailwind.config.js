/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        paper: '#f6f5f4',
        ink: '#000000',
        'muted-ink': '#615d59',
        'faint-ink': '#a39e98',
        hairline: '#e6e6e6',
        primary: '#004e9a',
        'primary-pressed': '#003b73',
        accent: '#dd5b00',
        teal: '#2a9d99',
        'badge-green': '#1aae39',
        'primary-tint': '#e6f0fe',
        error: '#c62828',
        'error-bg': '#fde8e8',
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
        button: '8px',
        input: '3px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
