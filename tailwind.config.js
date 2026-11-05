/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        surface: "var(--bg-surface)",
        elevated: "var(--bg-elevated)",
        subtle: "var(--border-subtle)",
        "tx-primary": "var(--text-primary)",
        "tx-muted": "var(--text-muted)",
        accent: "var(--accent)",
      },
    },
  },
  plugins: [],
};
